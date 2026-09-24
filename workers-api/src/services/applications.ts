import { applicationRepository, footprintRepository } from "../repositories";
import { storageService } from "./storage";
import { emailService } from "./email";
import type { ApplicationStatus, CreateApplicationInput } from "../schema";

type StoredApplication = Awaited<
  ReturnType<typeof applicationRepository.create>
>;

export const applicationService = {
  async create(
    input: CreateApplicationInput,
    resumeFile?: {
      buffer: ArrayBuffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    savedResume?: { path: string; filename: string | null },
  ) {
    let resumePath: string | null = savedResume?.path ?? null;
    let resumeFilename: string | null = savedResume?.filename ?? null;

    if (savedResume) {
      const copiedResume = await storageService.duplicate(
        savedResume.path,
        savedResume.filename,
      );
      resumePath = copiedResume.key;
      resumeFilename = copiedResume.filename;
    }
    if (resumeFile) {
      const uploadResult = await storageService.upload(resumeFile);
      resumePath = uploadResult.key;
      resumeFilename = uploadResult.filename;
    }

    try {
      const application = await applicationRepository.create({
        ...input,
        resumePath,
        resumeFilename,
      });
      try {
        await footprintRepository.record({
          subjectType: "candidate",
          subjectId: application.id,
          event: "applicationSubmitted",
          device: "candidate",
          meta: { position: application.position },
        });
      } catch (timelineError) {
        console.error(
          { timelineError, applicationId: application.id },
          "Application was saved but its timeline event could not be recorded",
        );
      }
      return application;
    } catch (error) {
      if (resumePath) {
        try { await storageService.delete(resumePath); }
        catch (cleanupError) { console.error({ cleanupError, resumePath }, "Failed to clean up orphaned resume"); }
      }
      throw error;
    }
  },

  async sendEmailsAsync(application: StoredApplication) {
    // Send each email independently so a failure of one never prevents the others.
    let notification = false;
    try {
      await emailService.sendApplicationNotification({
        applicationId: application.id,
        position: application.position,
        fullName: application.fullName,
      });
      notification = true;
    } catch (error) {
      console.error({ error, label: "HR notification" }, "Email send failed");
    }

    await this.trySend("applicant confirmation", () =>
      emailService.sendApplicantConfirmation({
        email: application.email,
        fullName: application.fullName,
        position: application.position,
        applicationId: application.id,
        referenceCode: application.referenceCode,
      }),
    );

    if (!notification) {
      console.error(
        { applicationId: application.id },
        "Application created but the HR notification email could not be delivered. Check Resend domain verification and HR_EMAIL.",
      );
    }
  },

  async trySend<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      console.error({ error, label }, "Email send failed");
      return null;
    }
  },

  async list() {
    return applicationRepository.findAll();
  },

  async findByEmail(email: string) {
    return applicationRepository.findByEmail(email);
  },

  async getById(id: string) {
    return applicationRepository.findById(id);
  },

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    options?: {
      meetLink?: string | null;
      interviewInstructions?: string | null;
      meetingKey?: string | null;
      backgroundUrl?: string | null;
      roomLink?: string | null;
      nextStepDelay?: number | null;
      notifyCandidate?: boolean;
    },
  ) {
    const application = await applicationRepository.findById(id);
    if (!application) return null;

    const {
      meetLink,
      interviewInstructions,
      meetingKey,
      backgroundUrl,
      roomLink,
      nextStepDelay,
      notifyCandidate = true,
    } = options ?? {};

    // Never email a no-op (same status re-save) and never fabricate an update
    // for "New" — a fresh application needs no "your status changed to New"
    // notice, and STATUS_DETAILS has no copy for it.
    const shouldNotify =
      notifyCandidate && status !== application.status && status !== "New";

    const updated = await applicationRepository.updateStatus(
      id,
      status,
      meetLink,
      interviewInstructions,
      meetingKey,
      {
        backgroundUrl,
        roomLink,
        nextStepDelay,
      },
    );
    if (!updated) return null;

    let notificationSent = false;
    if (shouldNotify) {
      notificationSent = (await this.trySend("status update email", () =>
        emailService.sendStatusUpdate({
          email: application.email,
          fullName: application.fullName,
          position: application.position,
          status,
          referenceCode: application.referenceCode,
        }),
      )) !== null;
    }

    if (status !== application.status) {
      try {
        await footprintRepository.record({
          subjectType: "candidate",
          subjectId: application.id,
          event: "statusChanged",
          device: "admin",
          meta: {
            fromStatus: application.status,
            toStatus: status,
            notificationRequested: shouldNotify,
            notificationSent,
          },
        });
      } catch (error) {
        // The status update has already been saved. A timeline write failure
        // must be visible in logs without turning a successful update into a
        // false API failure that an admin might retry.
        console.error(
          { error, applicationId: application.id, fromStatus: application.status, toStatus: status },
          "Application status was saved but its timeline event could not be recorded",
        );
      }
    }

    const updatedApplication = await applicationRepository.findById(id);
    if (!updatedApplication) return null;

    return {
      application: updatedApplication,
      notification: {
        requested: shouldNotify,
        sent: notificationSent,
      },
    };
  },

  async deleteApplication(id: string) {
    const application = await applicationRepository.findById(id);
    if (!application) return false;

    if (application.resumePath) {
      try {
        await storageService.delete(application.resumePath);
      } catch (error) {
        console.error({ error }, "Failed to delete resume file");
        throw new Error("Resume storage could not be deleted; application was retained for retry.");
      }
    }

    return applicationRepository.delete(id);
  },
};
