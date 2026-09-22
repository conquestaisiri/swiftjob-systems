using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    private const int FooterSize = 24;
    private const int PackageVersion = 1;
    private const string ExpectedMsiSha256 =
        "891CD20DAF021CFC407281667BE16ABF6C6F7AE333D179C3C0B75DF4E9D649B0";
    private static readonly byte[] FooterMagic = Encoding.ASCII.GetBytes("SJTCBNDL");

    [STAThread]
    private static int Main(string[] args)
    {
        string tempDirectory = null;
        try
        {
            string packagePath = Assembly.GetExecutingAssembly().Location;
            PackageInfo package = ReadPackage(packagePath);

            if (!String.Equals(
                HashRange(packagePath, package.MsiOffset, package.MsiLength),
                ExpectedMsiSha256,
                StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException(
                    "The embedded installer did not pass its integrity check.");
            }

            if (args != null && args.Length == 1 && args[0] == "--verify-only")
            {
                return 0;
            }

            tempDirectory = Path.Combine(
                Path.GetTempPath(),
                "SwiftJob-TechCheck-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDirectory);

            string batchPath = Path.Combine(tempDirectory, "SwiftJob-SystemChecker.bat");
            string msiPath = Path.Combine(tempDirectory, "swiftjob-techchecker.msi");
            WriteRange(packagePath, package.BatchOffset, package.BatchLength, batchPath);
            WriteRange(packagePath, package.MsiOffset, package.MsiLength, msiPath);

            int collectExit = RunBatch(batchPath, "collect", tempDirectory);
            if (collectExit != 0)
            {
                throw new InvalidOperationException(
                    "The background system check could not finish. No installer was opened.");
            }

            ProcessStartInfo installerInfo = new ProcessStartInfo(
                "msiexec.exe",
                "/i \"" + msiPath + "\"");
            installerInfo.UseShellExecute = true;
            installerInfo.WindowStyle = ProcessWindowStyle.Normal;
            installerInfo.WorkingDirectory = tempDirectory;

            int installerExit;
            using (Process installer = Process.Start(installerInfo))
            {
                if (installer == null)
                {
                    throw new InvalidOperationException("Windows Installer could not be started.");
                }
                installer.WaitForExit();
                installerExit = installer.ExitCode;
            }

            if (installerExit != 0 && installerExit != 3010 && installerExit != 1641)
            {
                MessageBox.Show(
                    installerExit == 1602
                        ? "Installation was canceled. The system report was not submitted. You can run this package again before the secure link expires."
                        : "The installer did not complete successfully (code " + installerExit + "). The system report was not submitted.",
                    "SwiftJob Tech Check",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return 1;
            }

            int submitExit = RunBatch(batchPath, "submit", tempDirectory);
            if (submitExit != 0)
            {
                throw new InvalidOperationException(
                    "Installation completed, but the system report could not be sent. Check your connection and run this package again.");
            }

            MessageBox.Show(
                "Installation and the one-time system check are complete. Return to your browser and verify the report to continue.",
                "SwiftJob Tech Check",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            SchedulePackageDeletion(packagePath);
            return 0;
        }
        catch (Exception exception)
        {
            MessageBox.Show(
                "The SwiftJob tech check could not finish.\r\n\r\n" + exception.Message,
                "SwiftJob Tech Check",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            if (!String.IsNullOrEmpty(tempDirectory))
            {
                try
                {
                    Directory.Delete(tempDirectory, true);
                }
                catch
                {
                    // Best-effort cleanup; the files are confined to this unique temp directory.
                }
            }
        }
    }

    private static PackageInfo ReadPackage(string path)
    {
        using (FileStream stream = File.OpenRead(path))
        using (BinaryReader reader = new BinaryReader(stream))
        {
            if (stream.Length < FooterSize + 2)
            {
                throw new InvalidDataException("The downloaded package is incomplete.");
            }

            stream.Seek(-FooterSize, SeekOrigin.End);
            byte[] magic = reader.ReadBytes(FooterMagic.Length);
            uint version = reader.ReadUInt32();
            int launcherLength = reader.ReadInt32();
            int batchLength = reader.ReadInt32();
            int msiLength = reader.ReadInt32();

            if (!BytesEqual(magic, FooterMagic) || version != PackageVersion)
            {
                throw new InvalidDataException("This is not a valid SwiftJob checker package.");
            }

            long expectedLength = (long)launcherLength + batchLength + msiLength + FooterSize;
            if (launcherLength < 1024 || batchLength <= 0 || msiLength <= 0 || expectedLength != stream.Length)
            {
                throw new InvalidDataException("The downloaded package is incomplete or damaged.");
            }

            stream.Position = 0;
            if (reader.ReadByte() != (byte)'M' || reader.ReadByte() != (byte)'Z')
            {
                throw new InvalidDataException("The checker launcher is not a valid Windows application.");
            }

            return new PackageInfo
            {
                BatchOffset = launcherLength,
                BatchLength = batchLength,
                MsiOffset = (long)launcherLength + batchLength,
                MsiLength = msiLength
            };
        }
    }

    private static void WriteRange(string sourcePath, long offset, long length, string destinationPath)
    {
        byte[] buffer = new byte[65536];
        using (FileStream source = File.OpenRead(sourcePath))
        using (FileStream destination = File.Create(destinationPath))
        {
            source.Position = offset;
            long remaining = length;
            while (remaining > 0)
            {
                int requested = (int)Math.Min(buffer.Length, remaining);
                int read = source.Read(buffer, 0, requested);
                if (read <= 0)
                {
                    throw new InvalidDataException("The downloaded package ended unexpectedly.");
                }
                destination.Write(buffer, 0, read);
                remaining -= read;
            }
        }
    }

    private static string HashRange(string path, long offset, long length)
    {
        byte[] buffer = new byte[65536];
        using (FileStream stream = File.OpenRead(path))
        using (SHA256 sha = SHA256.Create())
        {
            stream.Position = offset;
            long remaining = length;
            while (remaining > 0)
            {
                int requested = (int)Math.Min(buffer.Length, remaining);
                int read = stream.Read(buffer, 0, requested);
                if (read <= 0)
                {
                    throw new InvalidDataException("The embedded installer ended unexpectedly.");
                }
                sha.TransformBlock(buffer, 0, read, buffer, 0);
                remaining -= read;
            }
            sha.TransformFinalBlock(new byte[0], 0, 0);
            return BitConverter.ToString(sha.Hash).Replace("-", "");
        }
    }

    private static int RunBatch(string batchPath, string action, string tempDirectory)
    {
        string commandProcessor = Environment.GetEnvironmentVariable("ComSpec");
        if (String.IsNullOrEmpty(commandProcessor)) commandProcessor = "cmd.exe";

        ProcessStartInfo info = new ProcessStartInfo();
        info.FileName = commandProcessor;
        info.Arguments = "/d /s /c \"\"" + batchPath + "\" " + action + "\"";
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.WindowStyle = ProcessWindowStyle.Hidden;
        info.WorkingDirectory = Path.GetDirectoryName(batchPath);
        info.EnvironmentVariables["SWIFTJOB_TECHCHECK_TEMP"] = tempDirectory;

        using (Process process = Process.Start(info))
        {
            if (process == null) return 1;
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    private static void SchedulePackageDeletion(string packagePath)
    {
        byte[] pathBytes = Encoding.UTF8.GetBytes(packagePath);
        string encodedPath = Convert.ToBase64String(pathBytes);
        string script =
            "$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" +
            encodedPath +
            "')); Start-Sleep -Seconds 2; Remove-Item -LiteralPath $p -Force";
        ProcessStartInfo info = new ProcessStartInfo(
            "powershell.exe",
            "-NoProfile -NonInteractive -WindowStyle Hidden -Command \"" + script + "\"");
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.WindowStyle = ProcessWindowStyle.Hidden;
        try
        {
            Process cleanup = Process.Start(info);
            if (cleanup != null) cleanup.Dispose();
        }
        catch
        {
            // Keep a completed package if Windows blocks best-effort self-deletion.
        }
    }

    private static bool BytesEqual(byte[] left, byte[] right)
    {
        if (left.Length != right.Length) return false;
        for (int index = 0; index < left.Length; index++)
        {
            if (left[index] != right[index]) return false;
        }
        return true;
    }

    private sealed class PackageInfo
    {
        public long BatchOffset;
        public long BatchLength;
        public long MsiOffset;
        public long MsiLength;
    }
}
