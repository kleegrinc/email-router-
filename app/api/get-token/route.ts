import { prisma } from "../../../lib/prisma";
import { getToken } from "../../../lib/token";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
        return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
    }

    // STEP 2: VALIDATE AND REFRESH TOKEN
    const token = await getToken(locationId);

    return NextResponse.json(token);
}
