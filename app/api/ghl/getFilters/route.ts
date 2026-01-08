
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "../../../../lib/token";
import { getCustomFields, getTags } from "../../../../lib/ghl";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("Received Filters Event:", JSON.stringify(body, null, 2));

        const locationId = body?.extras?.locationId;
        console.log("locationId", locationId)

        if (!locationId) {
            return NextResponse.json({ message: "locationId within extras object is required" }, { status: 400 });
        }

        const tokenData = await getToken(locationId);

        if (!tokenData || !('accessToken' in tokenData)) {
            return NextResponse.json({ message: "Authorization failed: No token found for this location" }, { status: 401 });
        }

        // Fetch Custom Fields and Tags in parallel
        const [customFields, tags] = await Promise.all([
            getCustomFields(locationId, tokenData.accessToken!),
            getTags(locationId, tokenData.accessToken!)
        ]);

        // Base Static Filters from Image 1 & 2
        const staticFilters = [
            {
                field: "from",
                title: "From Address",
                fieldType: "string",
                required: false
            },
            {
                field: "to",
                title: "To Address",
                fieldType: "string",
                required: false
            },
            {
                field: "subject",
                title: "Subject",
                fieldType: "string",
                required: false
            },
            {
                field: "body",
                title: "Body",
                fieldType: "string",
                required: false
            }
        ];

        // Tag Options
        const tagOptions = tags?.map((tag: any) => ({
            label: tag.name,
            value: tag.id
        }));

        const tagFilters = [
            {
                field: "has_tag",
                title: "Has Tag",
                fieldType: "select",
                required: false,
                options: tagOptions
            },
            {
                field: "doesn't_has_tag",
                title: "Doesn't Has Tag",
                fieldType: "select",
                required: false,
                options: tagOptions
            }
        ];

        // Dynamic Custom Field Filters
        const customFieldFilters = customFields.map((cf: any) => {
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
                    // TEXT, LARGE_TEXT, FILE_UPLOAD, etc.
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

        const filters = [
            ...staticFilters,
            ...tagFilters,
            ...customFieldFilters
        ];

        return NextResponse.json({ filters });

    } catch (error: any) {
        console.error("Error in getFilters:", error);
        return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
    }
}
