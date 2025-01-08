// utils/dialogflow.ts
import axios from 'axios';

export const sendMessageToDialogflow = async (text: string) => {
    const sessionId = 12;
    const projectId = process.env.NEXT_PUBLIC_DIALOGFLOW_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DIALOGFLOW_KEY;
    const url = `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/${sessionId}:detectIntent`;

    const requestBody = {
        queryInput: {
            text: {
                text,
                languageCode: 'en',
            },
        },
    };

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json; charset=utf-8',
                'x-goog-user-project': projectId
            },
        });

        const queryResult = response.data.queryResult;

        if (queryResult.fulfillmentMessages && queryResult.fulfillmentMessages.length > 0) {
            return queryResult.fulfillmentMessages[0].text.text[0];
        }

        return queryResult.fulfillmentText || "Sorry, I didn't understand that.";

    } catch (error) {
        console.error('Dialogflow API Error:', error);
        return 'There was an error communicating with the chatbot.';
    }
};