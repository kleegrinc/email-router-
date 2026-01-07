import axios from "axios"

export const createCredentials = async (data: {
    client_name: string;
    wp_client_id: string;
    wp_client_secret: string;
}) => {
    try {
        let payload = JSON.stringify({
            "name": data.client_name,
            "type": "whatsAppTriggerApi",
            "data": {
                "clientId": data.wp_client_id,
                "clientSecret": data.wp_client_secret
            }
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://automate-website.macaws.ai/api/v1/credentials',
            headers: {
                'Content-Type': 'application/json',
                'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MWUzNDc2NS1mOGY0LTRlZWMtYjg3Zi0xNTdiZTc4ZTdjNjAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYzOTYxMTI1fQ.6dC8hTApAaS2tFcfPRLTtrrX9fgcuKcPqB3OpZONzn8'
            },
            data: payload
        };

        const response = await axios.request(config);
        return {
            success: true,
            message: "Credentials created successfully",
            credentials: response.data
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error creating credentials:', error.response?.data || error.message);
            throw new Error(`Failed to create credentials: ${error.response?.data?.message || error.message}`);
        }
        console.error('Unexpected error creating credentials:', error);
        throw new Error('An unexpected error occurred while creating credentials');
    }
}

export const activateWorkflow = async (data: {
    workflowId: string;
}) => {
    console.log('Activating workflow with ID:', data.workflowId);
    try {
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `https://automate-website.macaws.ai/api/v1/workflows/${data.workflowId}/activate`,
            headers: {
                'Content-Type': 'application/json',
                'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MWUzNDc2NS1mOGY0LTRlZWMtYjg3Zi0xNTdiZTc4ZTdjNjAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYzOTYxMTI1fQ.6dC8hTApAaS2tFcfPRLTtrrX9fgcuKcPqB3OpZONzn8'
            }
        };

        const response = await axios.request(config);
        return {
            success: true,
            message: "Workflow activated successfully",
            workflow: response.data
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error activating workflow:', error.response?.data || error.message);
            throw new Error(`Failed to activate workflow: ${error.response?.data?.message || error.message}`);
        }
        console.error('Unexpected error activating workflow:', error);
        throw new Error('An unexpected error occurred while activating workflow');
    }
}

export const createWorkflow = async (data: {
    client_name: string;
    creds_id: string;
}) => {
    try {
        let payload = JSON.stringify({
            "name": `${data?.client_name} Whatsapp Setup`,
            "nodes": [
                {
                    "parameters": {
                        "path": `verify-${data?.client_name.toLowerCase().replace(/\s+/g, '-')}`,
                        "options": {}
                    },
                    "type": "n8n-nodes-base.webhook",
                    "typeVersion": 2.1,
                    "position": [
                        32,
                        32
                    ],
                    "name": "Webhook"
                },
                {
                    "parameters": {
                        "httpMethod": "POST",
                        "path": `verify-${data?.client_name.toLowerCase().replace(/\s+/g, '-')}`,
                        "options": {}
                    },
                    "type": "n8n-nodes-base.webhook",
                    "typeVersion": 2.1,
                    "position": [
                        32,
                        240
                    ],
                    "name": "Webhook1"
                },
                {
                    "parameters": {
                        "workflowId": "oYHbYpCDH1Vz9t0f",
                        "options": {}
                    },
                    "id": "subworkflow",
                    "name": "Call Master Subworkflow1",
                    "type": "n8n-nodes-base.executeWorkflow",
                    "typeVersion": 1,
                    "position": [
                        272,
                        240
                    ]
                },
                {
                    "parameters": {
                        "respondWith": "text",
                        "responseBody": "={{ $json.query['hub.challenge'] }}",
                        "options": {
                            "responseCode": 200,
                            "responseHeaders": {
                                "entries": [
                                    {
                                        "name": "Content-Type",
                                        "value": "text/plain"
                                    }
                                ]
                            }
                        }
                    },
                    "type": "n8n-nodes-base.respondToWebhook",
                    "typeVersion": 1.4,
                    "position": [
                        288,
                        32
                    ],
                    "id": "277466ae-460a-430e-a073-239f8abd08e7",
                    "name": "Respond to Webhook1"
                }
            ],
            "connections": {
                "Webhook": {
                    "main": [
                        [
                            {
                                "node": "Respond to Webhook1",
                                "type": "main",
                                "index": 0
                            }
                        ]
                    ]
                },
                "Webhook1": {
                    "main": [
                        [
                            {
                                "node": "Call Master Subworkflow1",
                                "type": "main",
                                "index": 0
                            }
                        ]
                    ]
                }
            },
            "settings": {
                "saveExecutionProgress": true,
                "saveManualExecutions": true,
                "saveDataErrorExecution": "all",
                "saveDataSuccessExecution": "all",
                "executionTimeout": 3600,
                "errorWorkflow": "VzqKEW0ShTXA5vPj",
                "timezone": "America/New_York",
                "executionOrder": "v1",
                "callerPolicy": "workflowsFromSameOwner",
                "callerIds": "14, 18, 23",
                "timeSavedPerExecution": 1,
                "availableInMCP": false
            }
        })
        // let payload = JSON.stringify({
        //     "name": data?.client_name,
        //     "nodes": [
        //         {
        //             "id": "whatsapp-trigger",
        //             "name": "WhatsApp Trigger",
        //             "type": "n8n-nodes-base.whatsAppTrigger",
        //             "typeVersion": 1,
        //             "position": [
        //                 0,
        //                 0
        //             ],
        //             "parameters": {
        //                 "updates": [
        //                     "messages"
        //                 ],
        //                 "options": {}
        //             },
        //             "credentials": {
        //                 "whatsAppTriggerApi": {
        //                     "id": data?.creds_id,
        //                     "name": data?.client_name
        //                 }
        //             }
        //         },
        //         {
        //             "id": "subworkflow",
        //             "name": "Call Master Subworkflow",
        //             "type": "n8n-nodes-base.executeWorkflow",
        //             "typeVersion": 1,
        //             "position": [
        //                 350,
        //                 0
        //             ],
        //             "parameters": {
        //                 "workflowId": "oYHbYpCDH1Vz9t0f",
        //                 "options": {
        //                     "waitForReturn": false
        //                 }
        //             }
        //         }
        //     ],
        //     "connections": {
        //         "WhatsApp Trigger": {
        //             "main": [
        //                 [
        //                     {
        //                         "node": "Call Master Subworkflow",
        //                         "type": "main",
        //                         "index": 0
        //                     }
        //                 ]
        //             ]
        //         }
        //     },
        //     "settings": {
        //         "saveExecutionProgress": true,
        //         "saveManualExecutions": true,
        //         "saveDataErrorExecution": "all",
        //         "saveDataSuccessExecution": "all",
        //         "executionTimeout": 3600,
        //         "errorWorkflow": "VzqKEW0ShTXA5vPj",
        //         "timezone": "America/New_York",
        //         "executionOrder": "v1",
        //         "callerPolicy": "workflowsFromSameOwner",
        //         "callerIds": "14, 18, 23",
        //         "timeSavedPerExecution": 1,
        //         "availableInMCP": false
        //     }
        // });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://automate-website.macaws.ai/api/v1/workflows',
            headers: {
                'Content-Type': 'application/json',
                'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MWUzNDc2NS1mOGY0LTRlZWMtYjg3Zi0xNTdiZTc4ZTdjNjAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYzOTYxMTI1fQ.6dC8hTApAaS2tFcfPRLTtrrX9fgcuKcPqB3OpZONzn8'
            },
            data: payload
        };

        const response = await axios.request(config);
        return {
            success: true,
            message: "Workflow created successfully",
            workflow: response.data
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error creating workflow:', error.response?.data || error.message);
            throw new Error(`Failed to create workflow: ${error.response?.data?.message || error.message}`);
        }
        console.error('Unexpected error creating workflow:', error);
        throw new Error('An unexpected error occurred while creating workflow');
    }
}