import { NextRequest, NextResponse } from "next/server";
import { getToken } from "../../../../lib/token";
import { getTags } from "../../../../lib/ghl";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const locationId = body?.extras?.locationId;

        if (!locationId) {
            return NextResponse.json({ message: "locationId within extras object is required" }, { status: 400 });
        }

        const tokenData = await getToken(locationId);

        if (!tokenData || !('accessToken' in tokenData)) {
            return NextResponse.json({ message: "Authorization failed: No token found for this location" }, { status: 401 });
        }

        const tags = await getTags(locationId, tokenData.accessToken!);

        return NextResponse.json({ tags });

    } catch (error: any) {
        console.error("Error in getTags:", error);
        return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
    }
}
