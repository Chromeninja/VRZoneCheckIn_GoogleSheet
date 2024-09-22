# Google Sheet Structure

The VR Zone Group Check-In System uses a Google Sheet with multiple tabs to manage and track attendee check-ins, games, VR space assignments, and more. Here’s an overview of the key sheets and their structure:

## 1. **VRSpaces Sheet**

Tracks all VR stations, their availability, and assigned attendees.

| Column     | Description                            |
|------------|----------------------------------------|
| VR Space   | Name of the VR station (e.g., "VR 1")  |
| Status     | Availability status (Available/Occupied)|
| Game       | Game being played at this station      |
| First Name | First name of the attendee assigned    |
| Last Name  | Last name of the attendee assigned     |
| Check-In Time | Timestamp when the attendee started their session |
| Duration   | Duration of the VR session (calculated) |

## 2. **Tracker Sheet**

Logs every check-in and check-out with details for each session.

| Column       | Description                            |
|--------------|----------------------------------------|
| Session ID   | Unique session identifier              |
| Unique ID    | Unique ID for the attendee             |
| First Name   | First name of the attendee             |
| Last Name    | Last name of the attendee              |
| VR Space     | The VR station assigned to the attendee|
| Game         | The game the attendee selected         |
| Check-In Time| Timestamp when the attendee checked in |
| Check-Out Time | Timestamp when the attendee checked out |
| Duration     | Total time the attendee spent in VR    |

## 3. **Legal Sheet**

Stores legal waiver and user consent details, imported from a Google Form.

| Column      | Description                            |
|-------------|----------------------------------------|
| Timestamp   | Time when the attendee submitted the form |
| First Name  | First name of the attendee             |
| Last Name   | Last name of the attendee              |
| Email       | Attendee’s email address               |
| Consent     | Whether the attendee agreed to the legal terms (Yes/No) |
| Signature   | Attendee's electronic signature        |

