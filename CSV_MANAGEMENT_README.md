# CSV Management System

## Overview
The CSV Management System allows administrators to securely upload, preview, and manage CSV data files. These files are intended to be used for future site architecture mapping, bulk data imports, and market data updates.

## Features
- **Drag & Drop Upload**: Easily upload multiple CSV files at once.
- **File Validation**: Ensures only `.csv` files are accepted.
- **Size Limits**: Supports files up to 100MB per upload.
- **Preview Modal**: Instantly preview the first 100 rows of any uploaded CSV file directly in the browser using `papaparse`.
- **Secure Storage**: Files are stored securely in PocketBase with admin-only access rules.

## Accessing the System
1. Log in with an Administrator account.
2. Click on the **Admin Panel** dropdown in the main navigation header.
3. Select **CSV Management**.

## Usage Guide

### Uploading Files
1. Navigate to the **Upload CSV** tab.
2. Drag and drop your `.csv` files into the designated area, or click "Browse Files" to select them manually.
3. Review the selected files. You can remove any incorrect files before uploading.
4. Click **Upload Files**. A progress bar will indicate the upload status.
5. Upon success, the system will automatically switch to the "Manage Files" tab.

### Managing Files
1. Navigate to the **Manage Files** tab.
2. Use the search bar to quickly find specific files by name.
3. **Preview**: Click the eye icon to open a modal showing the parsed contents of the CSV (first 100 rows).
4. **Download**: Click the download icon to save the full file to your local machine.
5. **Delete**: Click the trash icon to permanently remove the file from the database.

## Technical Details
- **Database Collection**: `csvFiles`
- **Fields**: `filename`, `file`, `fileSize`, `uploadDate`, `uploadedBy`
- **Access Rules**: Strictly limited to users with `role = "admin"`.
- **Parsing Library**: `papaparse` is used for client-side CSV parsing and preview generation.