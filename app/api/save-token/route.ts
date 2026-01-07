/* eslint-disable */

import { prisma } from "../../../lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const data = await req.json();

        const {
            appId,
            access_token,
            refresh_token,
            userType,
            companyId,
            locationId,
            userId
        } = data;

        if (!locationId || !access_token) {
            return NextResponse.json(
                { error: "Missing required fields: locationId or access_token" },
                { status: 400 }
            );
        }

        //  console.log("Data received from GHL:", body);
        //   userId: 'mAc1ft72fCrPGPUq1YXh',
        // attachments: [],
        // contactId: 'RcoZ2SiWcOY3GPei4kDG',
        // locationId: 'JVFtHaeVMYmr2OyuI0vj',
        // messageId: 'Mm24Ycdo3g8l46lKmYPG',
        // type: 'SMS',
        // conversationId: 'v30ALgPBDwUIKmgcKJeQ',
        // phone: '+92543051240',
        // message: 'Hi',
        // customUserId: '',
        // conversationProviderId: '68f4b8c5a90a31716dae7442'


        // Save or update the record
        const tokenRecord = await prisma.token.upsert({
            where: { locationId },
            update: {
                appId,
                accessToken: access_token,
                refreshToken: refresh_token,
                userType,
                companyId,
                userId,
                expiresAt: new Date(Date.now() + 23 * 3600 * 1000), // 23 hours from now
            },
            create: {
                appId,
                accessToken: access_token,
                refreshToken: refresh_token,
                userType,
                companyId,
                locationId,
                userId,
                expiresAt: new Date(Date.now() + 23 * 3600 * 1000), // 23 hours from now
            },
        });

        return NextResponse.json({
            success: true,
            message: "Token saved successfully",
            data: tokenRecord,
        });
    } catch (error: any) {
        console.error("Error saving token:", error);
        return NextResponse.json(
            { error: "Failed to save token", details: error.message },
            { status: 500 }
        );
    }
}
