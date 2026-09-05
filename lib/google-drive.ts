import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';

// SCOPES for Drive API
const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
];
export const DEFAULT_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1bogWnsdHz_qjW-AHA5y9QAHWa7PdTQLw';

export interface DriveUploadResult {
    success: boolean;
    id?: string;
    webContentLink?: string;
    webViewLink?: string;
    error?: string;
    authType?: 'oauth' | 'service_account';
    quotaWarning?: boolean;
}

export class GoogleDriveService {
    private drive: any = null;
    private initError: string | null = null;
    private authType: 'oauth' | 'service_account' | null = null;

    constructor() {
        try {
            // Strategy 1: Check for OAuth 2.0 User Credentials (Bypasses Service Account 0MB quota)
            const tokenPath = path.join(process.cwd(), '.google_oauth_token.json');
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            let oauthTokens: any = null;

            if (process.env.GOOGLE_REFRESH_TOKEN && clientId && clientSecret) {
                oauthTokens = { refresh_token: process.env.GOOGLE_REFRESH_TOKEN };
            } else if (fs.existsSync(tokenPath) && clientId && clientSecret) {
                try {
                    oauthTokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                } catch { }
            }

            if (oauthTokens && clientId && clientSecret) {
                const oauth2Client = new google.auth.OAuth2(
                    clientId,
                    clientSecret,
                    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
                );
                oauth2Client.setCredentials(oauthTokens);
                this.drive = google.drive({ version: 'v3', auth: oauth2Client });
                this.authType = 'oauth';
                console.log("Google Drive initialized via User OAuth 2.0 (Personal Quota Active)");
                return;
            }

            // Strategy 2: Fallback to Service Account
            let serviceAuth;
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                serviceAuth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: SCOPES,
                });
            } else {
                const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'service_account_key.json');
                if (fs.existsSync(keyFilePath)) {
                    serviceAuth = new google.auth.GoogleAuth({
                        keyFile: keyFilePath,
                        scopes: SCOPES,
                    });
                } else {
                    this.initError = `Neither OAuth credentials nor Service Account key found.`;
                }
            }

            if (serviceAuth) {
                this.drive = google.drive({ version: 'v3', auth: serviceAuth });
                this.authType = 'service_account';
                console.log("Google Drive initialized via Google Service Account");
            }
        } catch (e: any) {
            this.initError = e?.message || "Failed to initialize Google Auth";
        }
    }

    /**
     * Uploads a file to Google Drive folder and sets it to be publicly readable if permitted.
     */
    async uploadFile(
        buffer: Buffer,
        filename: string,
        mimeType: string,
        parentFolderId: string = DEFAULT_DRIVE_FOLDER_ID
    ): Promise<DriveUploadResult> {
        if (!this.drive) {
            console.warn("Google Drive Service not initialized:", this.initError);
            return {
                success: false,
                error: this.initError || "Drive client not configured",
            };
        }

        try {
            const stream = Readable.from(buffer);

            const requestBody: any = {
                name: filename,
                mimeType,
            };
            if (parentFolderId) {
                requestBody.parents = [parentFolderId];
            }

            const response = await this.drive.files.create({
                requestBody,
                media: {
                    mimeType,
                    body: stream,
                },
                fields: 'id, webContentLink, webViewLink',
                supportsAllDrives: true,
            });

            const fileId = response.data.id;
            if (!fileId) {
                return { success: false, error: "File upload returned no ID" };
            }

            // Attempt to make public for direct playback/sharing
            try {
                await this.drive.permissions.create({
                    fileId,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone',
                    },
                    supportsAllDrives: true,
                });
            } catch (permError: any) {
                console.warn("Google Drive: Could not set public permission (Org policy or limited role):", permError?.message);
            }

            return {
                success: true,
                id: fileId,
                webContentLink: response.data.webContentLink,
                webViewLink: response.data.webViewLink,
                authType: this.authType || 'service_account',
            };

        } catch (error: any) {
            const errMsg = error?.response?.data?.error?.message || error?.message || "Google Drive upload failed";
            const isQuotaError = errMsg.includes("storage quota") || errMsg.includes("Service Accounts do not have storage quota");

            console.warn('Google Drive Upload Warning:', errMsg);

            return {
                success: false,
                error: isQuotaError
                    ? "Service Accounts have 0 MB quota on personal Google Drives. Use a Google Workspace Shared Drive or connect via Google OAuth to upload directly to your personal Drive."
                    : errMsg,
                quotaWarning: isQuotaError,
                authType: this.authType || 'service_account',
            };
        }
    }
}
