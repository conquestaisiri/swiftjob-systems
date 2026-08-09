import { applicationRepository } from "../repositories";
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
  ) {
    let resumePath: string | null = null;
    let resumeFilename: string | null = null;

    if (resumeFile) {
      const uploadResult = await storageService.upload(resumeFile);
      resumePath = uploadResult.key;
      resumeFilename = uploadResult.filename;
    }

    const application = await applicationRepository.create({
      ...input,
      resumePath,
      resumeFilename,
    });

    return application;
  },

  async sendEmailsAsync(application: StoredApplication) {
    // Send each email independently so a failure of one never prevents the others.
    const notification = await this.trySend("HR notification", () =>
      emailService.sendApplicationNotification({
        applicationId: application.id,
        position: application.position,
        fullName: application.fullName,
        email: application.email,
        phone: application.phone,
        country: application.country,
        city: application.city,
        linkedinUrl: application.linkedinUrl || undefined,
        portfolioUrl: application.portfolioUrl || undefined,
        yearsExperience: application.yearsExperience,
        education: application.education,
        englishProficiency: application.englishProficiency,
        noticePeriod: application.noticePeriod,
        expectedSalary: application.expectedSalary,
        earliestStartDate: application.earliestStartDate,
        skills: application.skills,
      }),
    );

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
      notes?: string;
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
      notes,
      meetLink,
      interviewInstructions,
      meetingKey,
      backgroundUrl,
      roomLink,
      nextStepDelay,
      notifyCandidate = true,
    } = options ?? {};

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

    if (notifyCandidate) {
      await this.trySend("status update email", () =>
        emailService.sendStatusUpdate({
          email: application.email,
          fullName: application.fullName,
          position: application.position,
          status,
          applicationId: application.id,
          referenceCode: application.referenceCode,
          notes,
          interviewInstructions:
            status === "Shortlisted" && interviewInstructions
              ? interviewInstructions
              : undefined,
          isShortlistUpdate: status === "Shortlisted",
        }),
      );
    }

    return applicationRepository.findById(id);
  },

  async deleteApplication(id: string) {
    const application = await applicationRepository.findById(id);
    if (!application) return false;

    if (application.resumePath) {
      try {
        await storageService.delete(application.resumePath);
      } catch (error) {
        console.error({ error }, "Failed to delete resume file");
      }
    }

    return applicationRepository.delete(id);
  },
};
