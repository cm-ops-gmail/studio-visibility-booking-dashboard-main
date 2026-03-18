import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '13H2FFJ8WzKbis-Ud9SXlea9NNTM6exnOaguML8MVZI4';
const SHEET_NAME = 'Daywise_Class_OPS';
const REQUESTS_SHEET_NAME = 'Requests';
const BULK_SHEET_NAME = 'Bulk Slot Booking';

// Credentials use environment variables with hardcoded fallbacks for local development
const CREDENTIALS = {
  type: "service_account",
  project_id: "pelagic-range-466218-p1",
  private_key_id: "a94c2fbe1cdbbf8d303ba73de4a833b224ca626d",
  private_key: (process.env.GOOGLE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCk38vIK+mRrLC6
QNflraVEmv6ufxIzswb6RQZgAX4QFEP3Rlj+4oPMwjIdLHPXLRsKv9TfycjwJTfk
YMsHK29Md5BnJ1Q1TNe5muh4bWZRAHW3zHOlAMYyewlU/aczGRBvc6k1gax4hzDB
Xpi8YnQEdfhwFsbBIH1CqxhoHzkEK73He2TpS/kzNBhtiK6Rtjmx2taH9wCTkYc9
XvtE9/ZD6FxwargD80vPz8tn7WroyTXJKx0+rMf7OCnqgKgtKd0u3IRdXyffs2Iu
oCMoZB7HBm42bZ3WcyQlOuyC48MawnafvF3Z7lvGCADVq8isyplvkaDFRkCIP0FS
OYstZveVAgMBAAECggEAESYH24+ZsSGtlgnFiumXPX4DjGHCImd2C9TfF2BAXOrG
sPL7sbMcs1DlhnxHpjNWUzVlrkseH8A3QoVAyMOfRWxQNDJ2gz61V2RB1rjGQhmS
pOXah2h/tONwMotZdyqdt4HnsR2GM1kYXJx6tWlmGMquZvYvgQngjW0fUkEhHIpH
NkCzFbUmV4Aq/t/MnqQ7ya3VUAO8DNIpBpLJ78F3Ryc6E6L7FTU/KiVYT7h+rTRy
ztZEhlN4//5FZoXPTpwwvVgTLq33e8UJOQjV6UVV465eF0tY21TZcO9uxdA6buoT
XhMH4b83jSpOx/l0RdvPPvskpqdmFc3f3aBD27MUQQKBgQDix73F1seQfeEoBmjY
dK94/hCQinRsHOqB0K+9g2dD1w+Ljthl8EPImi29upZ+ti4dza+PfgAWGQZ0tSLz
pO6OhFP+0b74Hw2uyNliytYJKlgcXXueXMtndd3cKOWXd/0AWSFfXXDL/7m4h17B
CrZxD/Sfwzs0dkbZAMGgVq5OdQKBgQC6HhumFHrnz4mjsXlZ5jzfnTbnfIqO4mR6
U8+J+WVRkF/qLiCOMmTbK2YPNuU51knls/kqK2iczBUTUAXZeK8BBJlwisZuXj//
5XbfO4BVOy0UXMAK+roqscWXznj4Fb+ciidSzsWVKxeoy5Qh94PwYq2i4bSkCFuH
rWtRYvUgoQKBgCcAYRPQP1wLOhjPGWL4lmEBmMmy9hjN1ErlIARAwBa7utGujGrj
qlSqp2k02MMMA9xeTm4oJk2mmiSiLlOmrtxVx7hQTD6R4KGJq1FBPxQucx7VuPfg
T58Id1JwuiOVoC5aJdIn2MlMvp0MsvASLpQ9QT3krp70JHUXmzU/ExUtAoGBALMG
CPRcmMhnse555M9bjsxNTiWmfyTnkVy1R1lhQlsNc6UvT3NX9/l1qksSM7XJcPV5
gz9T1+GS0Obtv2KrGjLxeKJvamV5VThRQWGCu3PAYyFGAhfNistMilL2cRe428G4
hhC6AgX1GGHtyIRPsGLGmFynnHl37Ir6fdMgS8dhAoGBAKRrHpDuGNwuzzG2ocUG
0plGxx/Efei9FesQNGMnnHRG2tVcRZzs0NFzwu/Q4hY1b2jTfsI88ZQ0Xr0nKC87
UhOVYSXOd+4wvtMi1QllnViE36Wo0V230rg4QqVs5WndnHAkUTXQwnAqCwaEOqH7
AdIemxZqJ2/0pQnTLSSrygzI
-----END PRIVATE KEY-----`).replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL || "requisition-dashboard-edit@pelagic-range-466218-p1.iam.gserviceaccount.com",
};

export async function getSheetData() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:ZZ`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 3) return [];

    const headers = (rows[0] || []).map(h => String(h || '').trim());
    
    return rows.slice(2)
      .filter(row => row && row.length > 0)
      .map((row, index) => {
        const obj: any = { id: `row-${index}` };
        headers.forEach((header, i) => {
          if (header) {
            obj[header] = row[i];
          }
        });
        return obj;
      });
  } catch (error) {
    console.error('Error fetching google sheet data:', error);
    return [];
  }
}

export async function getRequestsData() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${REQUESTS_SHEET_NAME}!A:G`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0].map(h => String(h || '').trim());
    return rows.slice(1).map((row) => {
      const obj: any = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  } catch (error) {
    console.error('Error fetching requests from sheet:', error);
    return [];
  }
}

export async function getBulkBookingData() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BULK_SHEET_NAME}!A:ZZ`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 1) return [];

    const headers = rows[0].map(h => String(h || '').trim());
    return rows.slice(1).map((row, index) => {
      const obj: any = { id: `bulk-${index}` };
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  } catch (error) {
    console.error('Error fetching bulk bookings:', error);
    return [];
  }
}

export async function appendBulkBookingData(data: string[][]) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Check if sheet exists, if not create it with headers
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${BULK_SHEET_NAME}!A1`,
      });
    } catch (e) {
      const headers = ["Date", "Scheduled Time", "Product Type", "Course", "Subject", "Topic", "Teacher 1", "Studio", "StartTimeISO", "EndTimeISO"];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${BULK_SHEET_NAME}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] }
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BULK_SHEET_NAME}!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: data,
      },
    });
  } catch (error) {
    console.error('Error appending bulk booking to sheet:', error);
  }
}

export async function appendRequestData(data: string[]) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${REQUESTS_SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [data],
      },
    });
  } catch (error) {
    console.error('Error appending request to sheet:', error);
  }
}

export async function updateRequestStatusInSheet(id: string, status: string) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${REQUESTS_SHEET_NAME}!A:A`,
    });
    
    const rows = response.data.values;
    if (!rows) return;
    
    const rowIndex = rows.findIndex(row => row[0] === id);
    if (rowIndex === -1) return;

    // Status is in column F (index 5)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${REQUESTS_SHEET_NAME}!F${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status]],
      },
    });
  } catch (error) {
    console.error('Error updating status in sheet:', error);
  }
}
