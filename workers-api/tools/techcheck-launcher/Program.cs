using System;
using System.Drawing;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Program
{
    private const int FooterSize = 24;
    private const int PackageVersion = 2;
    private const int InstallWindowMilliseconds = 10 * 60 * 1000;
    private const string ReportFileName = "system-check-report.json";
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

            // Be explicit about the inventory and its submission before any
            // system scan, network request, or installer is started.
            if (!ShowConsentPrompt())
            {
                return 0;
            }

            Stopwatch installWindow = Stopwatch.StartNew();
            int startExit = RunBatch(batchPath, "start", tempDirectory);
            if (startExit != 0)
            {
                throw new InvalidOperationException(
                    "The secure ten-minute install window could not be started. Check your connection and run the checker again.");
            }

            // Once the candidate confirms, start the disclosed system scan in
            // the background and open the normal Windows Installer immediately.
            Task<int> collectTask = Task.Run(
                () => RunBatch(batchPath, "collect", tempDirectory));

            ProcessStartInfo installerInfo = new ProcessStartInfo(
                "msiexec.exe",
                "/i \"" + msiPath + "\"");
            installerInfo.UseShellExecute = true;
            installerInfo.WindowStyle = ProcessWindowStyle.Normal;
            installerInfo.WorkingDirectory = tempDirectory;

            int installerExit;
            bool installWindowExpired = false;
            try
            {
                using (Process installer = Process.Start(installerInfo))
                {
                    if (installer == null)
                    {
                        throw new InvalidOperationException("Windows Installer could not be started.");
                    }
                    while (!installer.WaitForExit(250))
                    {
                        if (installWindow.ElapsedMilliseconds >= InstallWindowMilliseconds)
                        {
                            installWindowExpired = true;
                        }
                    }
                    installerExit = installer.ExitCode;
                }
            }
            catch
            {
                // Do not leave the disclosed scan running against a directory
                // that the cleanup below is about to remove.
                collectTask.GetAwaiter().GetResult();
                throw;
            }

            int collectExit = collectTask.GetAwaiter().GetResult();
            if (collectExit != 0)
            {
                MessageBox.Show(
                    "The system scan could not finish. No report was sent. You can run the checker again before its secure link expires.",
                    "SwiftJob Tech Check",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return 1;
            }

            if (installWindow.ElapsedMilliseconds >= InstallWindowMilliseconds)
            {
                installWindowExpired = true;
            }

            if (installWindowExpired)
            {
                MessageBox.Show(
                    "The installer was not stopped, but it finished after the ten-minute check window. The report was not submitted. Contact SwiftJob support for a fresh check.",
                    "SwiftJob Tech Check",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return 1;
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

    private static bool ShowConsentPrompt()
    {
        using (Form dialog = new Form())
        {
            dialog.Text = "SwiftJob Tech Check";
            dialog.ClientSize = new Size(640, 440);
            dialog.FormBorderStyle = FormBorderStyle.FixedDialog;
            dialog.StartPosition = FormStartPosition.CenterScreen;
            dialog.MaximizeBox = false;
            dialog.MinimizeBox = false;

            Label heading = new Label();
            heading.AutoSize = true;
            heading.Location = new Point(22, 18);
            heading.Font = new Font("Segoe UI", 14F, FontStyle.Bold);
            heading.Text = "Review the one-time system check";

            Label details = new Label();
            details.AutoSize = false;
            details.Location = new Point(24, 58);
            details.Size = new Size(590, 292);
            details.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);
            details.Text =
                "Click Continue to start the scan in the background and open the standard Windows Installer, which will show its normal installation steps.\r\n\r\n" +
                "The scan reads: device type; computer manufacturer and model; Windows edition, version, build, architecture, and system type; CPU model, cores, threads, and maximum clock; installed and available memory; graphics adapter, driver, and reported memory; local fixed-disk letters, sizes, and free space; the current check time; and any existing Windows system-rating score. It does not run a stress test or a new benchmark, and does not collect serial numbers, personal documents, passwords, or browsing history.\r\n\r\n" +
                "The report is sent to SwiftJob and attached to your application only after the installer completes successfully. If you cancel here, the scan and installer will not start. If you cancel or the installer fails, the report is not sent.";

            Button continueButton = new Button();
            continueButton.Text = "Continue";
            continueButton.DialogResult = DialogResult.OK;
            continueButton.Size = new Size(112, 34);
            continueButton.Location = new Point(376, 382);

            Button cancelButton = new Button();
            cancelButton.Text = "Cancel";
            cancelButton.DialogResult = DialogResult.Cancel;
            cancelButton.Size = new Size(112, 34);
            cancelButton.Location = new Point(502, 382);

            dialog.Controls.Add(heading);
            dialog.Controls.Add(details);
            dialog.Controls.Add(continueButton);
            dialog.Controls.Add(cancelButton);
            dialog.AcceptButton = continueButton;
            dialog.CancelButton = cancelButton;

            return dialog.ShowDialog() == DialogResult.OK;
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
        info.EnvironmentVariables["SWIFTJOB_TECHCHECK_REPORT"] =
            Path.Combine(tempDirectory, ReportFileName);

        using (Process process = Process.Start(info))
        {
            if (process == null) return 1;
            process.WaitForExit();
            return process.ExitCode;
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
