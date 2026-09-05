import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(new URL(`/create?oauth_error=${encodeURIComponent(error)}`, req.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL("/create?oauth_error=no_code", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(new URL("/create?oauth_error=missing_credentials", req.url));
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${protocol}://${host}/api/auth/google/callback`;

    try {
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Persist token locally for subsequent server uploads
        const tokenPath = path.join(process.cwd(), ".google_oauth_token.json");
        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), "utf-8");

        console.log("Google OAuth tokens obtained and saved successfully.");
        return NextResponse.redirect(new URL("/create?oauth=success", req.url));
    } catch (err: any) {
        console.error("Google OAuth token exchange failed:", err?.message || err);
        return NextResponse.redirect(new URL(`/create?oauth_error=${encodeURIComponent(err?.message || "exchange_failed")}`, req.url));
    }
}

