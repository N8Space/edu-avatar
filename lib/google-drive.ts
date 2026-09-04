import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';

// SCOPES for Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive'];
export const DEFAULT_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1bogWnsdHz_qjW-AHA5y9QAHWa7PdTQLw';

export interface DriveUploadResult {
    success: boolean;
    id?: string;
    webContentLink?: string;
    webViewLink?: string;
    error?: string;
}

export class GoogleDriveService {
    private drive: any = null;
    private initError: string | null = null;

    constructor() {
        try {
            let auth;
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: SCOPES,
                });
            } else {
                const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'service_account_key.json');
                if (fs.existsSync(keyFilePath)) {
                    auth = new google.auth.GoogleAuth({
                        keyFile: keyFilePath,
                        scopes: SCOPES,
                    });
                } else {
                    this.initError = `Service account key file not found at ${keyFilePath}`;
                }
            }

            if (auth) {
                this.drive = google.drive({ version: 'v3', auth });
            }
        } catch (e: any) {
            this.initError = e?.message || "Failed to initialize Google Auth";
        }
    }

    /**
     * Uploads a file to Google Drive folder and sets it to be publicly readable if permitted.
     * @param buffer The file content as a Buffer.
     * @param filename The name of the file.
     * @param mimeType The MIME type of the file.
     * @param parentFolderId The ID of the folder to upload to (defaults to DEFAULT_DRIVE_FOLDER_ID).
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
            };

        } catch (error: any) {
            const errMsg = error?.response?.data?.error?.message || error?.message || "Google Drive upload failed";
            console.warn('Google Drive Upload Warning:', errMsg);
            return {
                success: false,
                error: errMsg,
            };
        }
    }
}
