import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
    const hasClientId = Boolean(process.env.GOOGLE_CLIENT_ID);
    const hasClientSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
    const hasEnvRefreshToken = Boolean(process.env.GOOGLE_REFRESH_TOKEN);

    const tokenPath = path.join(process.cwd(), ".google_oauth_token.json");
    const hasFileToken = fs.existsSync(tokenPath);

    const isConnected = hasEnvRefreshToken || hasFileToken;

    const hasServiceAccount = Boolean(
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
        fs.existsSync(path.join(process.cwd(), "service_account_key.json"))
    );

    return NextResponse.json({
        oauthConfigured: hasClientId && hasClientSecret,
        oauthConnected: isConnected,
        serviceAccountAvailable: hasServiceAccount,
        driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "1bogWnsdHz_qjW-AHA5y9QAHWa7PdTQLw",
    });
}

