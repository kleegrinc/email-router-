import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import axios from "axios";
import { getToken } from "../../../lib/token";
import { getContact, getTags } from "../../../lib/ghl";

function matchFilter(filter: any, eventData: any): boolean {
    const field = filter.field;
    const operator = filter.operator;
    const value = filter.value;

    let actualValue = eventData[field];

    // Helper to standardise string for comparison
    const getString = (val: any) => {
        if (Array.isArray(val)) return val.join(" ");
        if (val === undefined || val === null) return "";
        return String(val);
    };

    const stringValue = getString(actualValue).toLowerCase();

    console.log(`[MatchFilter] Field: ${field}, Operator: ${operator}, ActualValue (Raw): ${actualValue}, Normalized: '${stringValue}'`);

    if (operator === 'has_value') {
        return stringValue.trim() !== "";
    }

    if (operator === 'string-contains-any-of') {
        const targets = Array.isArray(value) ? value : [value];
        console.log(`[MatchFilter] Checking targets:`, JSON.stringify(targets));
        // Check if the actual value contains ANY of the target strings
        return targets.some((t: any) => {
            const target = String(t).toLowerCase();
            const matched = stringValue.includes(target);
            console.log(`   -> Contains Check: '${stringValue}' includes '${target}'? ${matched}`);

            if (matched) return true;

            // Special handling for 'from' field to allow matching by Name OR Email if full string fails
            if (field === 'from') {
                const parseAddress = (str: string) => {
                    if (str.includes('<')) {
                        const parts = str.split('<');
                        return { name: parts[0].trim(), email: parts[1]?.replace('>', '').trim() || '' };
                    }
                    return { name: str, email: '' };
                };

                const tParts = parseAddress(target);
                const aParts = parseAddress(stringValue);

                if (tParts.name && aParts.name && aParts.name.includes(tParts.name)) {
                    console.log(`   -> Relaxed 'From' Name Match: '${aParts.name}' includes '${tParts.name}'`);
                    return true;
                }
                if (tParts.email && aParts.email && aParts.email.includes(tParts.email)) {
                    console.log(`   -> Relaxed 'From' Email Match: '${aParts.email}' includes '${tParts.email}'`);
                    return true;
                }
            }

            return false;
        });
    }

    return true;
}

function transformPayload(inbound: any, has_tag_name: string) {
    let to = inbound.to;
    if (Array.isArray(inbound.to) && inbound.to.length > 0) {
        to = inbound.to[0];
    }

    // Parse 'from' to extract only the email address if it's in "Name <email>" format
    let from = inbound.from;
    if (from && typeof from === 'string' && from.includes('<')) {
        const parts = from.split('<');
        if (parts.length > 1) {
            from = parts[1].replace('>', '').trim();
        }
    }

    return {
        type: inbound.type,
        locationId: inbound.locationId,
        body: inbound.body,
        contactId: inbound.contactId,
        conversationId: inbound.conversationId,
        dateAdded: inbound.dateAdded,
        direction: inbound.direction,
        messageType: inbound.messageType,
        emailMessageId: inbound.emailMessageId,
        from: from,
        threadId: inbound.threadId,
        subject: inbound.subject,
        to: to,
        conversationProviderId: inbound.conversationProviderId,
        has_tag: has_tag_name || "tag"
    };
}


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { locationId } = body;

        // {
        //   "type": "InboundMessage",
        //   "locationId": "kF4NJ5gzRyQF2gKFD34G",
        //   "body": "<div style=\"font-family: verdana, geneva; font-size: 11pt;\">Testing Email Notification</div>",
        //   "contactId": "3bN9f8LYJFG8F232XMUbfq",
        //   "conversationId": "yCdNo6pwyTLYKgg6V2gj",
        //   "dateAdded": "2024-01-12T12:59:04.045Z",
        //   "direction": "inbound",
        //   "messageType": "Email",
        //   "emailMessageId": "sddfDSF3G56GHG",
        //   "from": "Internal Notify <sample@email.service>",
        //   "threadId": "sddfDSF3G56GHG",
        //   "subject": "Order Confirmed",
        //   "to": "testprasath95@gmail.com",
        //   "conversationProviderId": "cI08i1Bls3iTB9bKgF01"
        // }


        // console.log("Received GHL Inbound Message Webhook for location:", locationId);
        // console.log("Incoming Webhook Body:", JSON.stringify(body, null, 2));

        if (!locationId) {
            return NextResponse.json({ message: "locationId missing" }, { status: 400 });
        }


        if (body.direction !== "inbound" && body.messageType !== "Email") {
            console.log("Not an inbound email message, skipping processing");
            return NextResponse.json({ message: "Not an inbound email message" });
        }

        // Fetch triggers
        const triggers = await prisma.trigger.findMany({
            where: {
                locationId: locationId,
                eventType: { not: "DELETED" },
                key: "email_router"
            }
        });

        console.log(`Found ${triggers.length} triggers for location ${locationId}`);

        if (triggers.length === 0) {
            console.log(`No triggers found for location ${locationId}`);
            return NextResponse.json({ message: "No triggers found" });
        }

        // Get Token
        const tokenOrError = await getToken(locationId);

        let accessToken = null;
        if (tokenOrError && typeof tokenOrError === 'object' && 'accessToken' in tokenOrError) {
            accessToken = tokenOrError.accessToken;
        } else {
            console.error(`Valid token not found or validation failed for location ${locationId}`);
            return NextResponse.json({ message: "Valid token not found" }, { status: 401 });
        }

        const executionResults = [];

        let has_tag_name = "";

        for (const trigger of triggers) {
            let run = true;
            // Filters check
            if (trigger.filters) {
                const filterArray = Array.isArray(trigger.filters) ? trigger.filters : [trigger.filters];
                console.log(`Checking filters for trigger ${trigger.ghlId}`, JSON.stringify(filterArray, null, 2));

                // Check if we need to fetch contact details for tag filtering
                const needsContactFetch = filterArray.some((f: any) => f.field === 'has_tag' || f.field === "doesn't_has_tag");
                let contactData: any = null;
                let locationTags: any[] = [];

                if (needsContactFetch && body.contactId && accessToken) {
                    try {
                        const [contact, tags] = await Promise.all([
                            getContact(accessToken, body.contactId),
                            getTags(locationId, accessToken)
                        ]);
                        contactData = contact;
                        locationTags = tags;
                    } catch (err) {
                        console.error("Error fetching contact or tags for filtering:", err);
                    }
                }

                // console.log("contactData", contactData)
                // console.log("locationTags", locationTags)

                for (const f of filterArray) {
                    const filter = f as any;
                    let match = false;

                    if (filter.field === 'has_tag') {
                        if (!contactData) {
                            console.log(`Contact data missing for tag filter ${filter.field}. Assuming mismatch.`);
                            match = false;
                        } else {
                            const operator = filter.operator;

                            // HighLevel usually sends the Tag NAME in the value for select fields if the option value was just the name.
                            // But in getFilters we set value: tag.id. So we expect ID here.
                            const tagValueCheck = filter.value;

                            // We need to match against the Contact's tags which are an array of Strings (Names).
                            // So we must resolve the tag ID from the filter to a Name.
                            // If the filter value is already a name (legacy or other), we handle that too.

                            let targetTagName = String(tagValueCheck).toLowerCase();
                            has_tag_name = targetTagName;

                            // Try to find if the value corresponds to an ID in our fetched tags list
                            const tagObj = locationTags.find(t => t.name === tagValueCheck);
                            if (tagObj) {
                                targetTagName = tagObj.name;
                            }

                            const contactTags = (contactData.tags || []).map((t: string) => t);
                            const hasTag = contactTags.includes(targetTagName);

                            console.log(`[Tag Check] Target: '${targetTagName}', ContactTags: ${JSON.stringify(contactTags)}, HasTag: ${hasTag}`);

                            // Operator Handling
                            if (operator === '==' || operator === 'string-contains-any-of' || operator === 'array-contains') {
                                match = hasTag;
                            } else if (operator === '!=') {
                                match = !hasTag;
                            } else if (operator === 'has_value') {
                                // "Has Tag" -> "Is Not Empty" ? usually means "User has ANY tag" or "This filter field is set".
                                // In the context of "Has Tag" field:
                                // If the user selects "Has Tag" is not empty... it implies "Contact has at least one tag"?
                                match = contactTags.length > 0;
                            } else if (operator === 'has_no_value') {
                                match = contactTags.length === 0;
                            } else {
                                // Fallback
                                match = hasTag;
                            }
                        }
                    } else {
                        // Standard field match
                        match = matchFilter(filter, body);
                    }

                    // console.log("match", match)

                    console.log(`Filter check - Field: ${filter.field}, Operator: ${filter.operator}, Value: ${filter.value}, Matched: ${match}`);

                    if (!match) {
                        run = false;
                        console.log(`Trigger ${trigger.ghlId} filter mismatch. Stopping execution.`);
                        break;
                    }
                }
            }

            if (run) {
                console.log(`Executing Trigger ${trigger.ghlId}`);
                const payload = transformPayload(body, has_tag_name);
                console.log(`Payload being sent to ${trigger.targetUrl}:`, JSON.stringify(payload, null, 2));

                try {
                    const res = await axios.post(trigger.targetUrl, payload, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Version': '2021-07-28',
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    console.log(`Trigger ${trigger.ghlId} executed successfully. Status: ${res.status}`);
                    console.log(`Response from ${trigger.targetUrl}:`, JSON.stringify(res.data, null, 2));
                    executionResults.push({ id: trigger.ghlId, status: "success", data: res.data });
                } catch (err: any) {
                    console.error(`Error executing trigger ${trigger.ghlId}:`, err.message, err.response?.data);
                    executionResults.push({ id: trigger.ghlId, status: "failed", error: err.message });
                }
            } else {
                console.log(`Trigger ${trigger.ghlId} skipped due to filters`);
            }
        }

        return NextResponse.json({ message: "Processed", results: executionResults });

    } catch (error: any) {
        console.error("Aimfox Webhook Handler Error:", error);
        return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
    }
}
