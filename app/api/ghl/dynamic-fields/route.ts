
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "../../../../lib/token";
import { getCustomFields } from "../../../../lib/ghl";

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

        const customFields = await getCustomFields(locationId, tokenData.accessToken!);

        const filters = customFields.map((cf: any) => {
            let fieldType = "string";
            let options = undefined;

            switch (cf.dataType) {
                case "SINGLE_OPTIONS":
                case "RADIO":
                    fieldType = "select";
                    break;
                case "MULTIPLE_OPTIONS":
                case "CHECKBOX":
                    fieldType = "multiselect";
                    break;
                case "NUMERICAL":
                case "MONETARY":
                    fieldType = "number";
                    break;
                case "DATE":
                    fieldType = "date";
                    break;
                default:
                    // TEXT, LARGE_TEXT
                    fieldType = "string";
            }

            if (fieldType === "select" || fieldType === "multiselect") {
                if (cf.picklistOptions && cf.picklistOptions.length > 0) {
                    options = cf.picklistOptions.map((opt: string) => ({ label: opt, value: opt }));
                } else if (cf.picklistImageOptions && cf.picklistImageOptions.length > 0) {
                    options = cf.picklistImageOptions.map((opt: any) => ({ label: opt.label, value: opt.label }));
                }
            }

            return {
                field: cf.id,
                title: cf.name,
                fieldType: fieldType,
                required: false,
                ...(options ? { options } : {})
            };
        });

        return NextResponse.json({ filters });

    } catch (error: any) {
        console.error("Error in getAllCustomFields:", error);
        return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
    }
}
