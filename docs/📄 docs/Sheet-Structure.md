# Google Sheet Structure for VR Zone Group Check-In System

The VR Zone Group Check-In System uses a Google Sheet with multiple tabs to manage and track attendee check-ins, games, VR space assignments, and more. Below is an overview of the key sheets, including the **Waitlist Sheet** you've requested.

## 1. **VRSpaces Sheet**

Tracks all VR stations, their availability, and assigned attendees.

| Column         | Description                                       |
|----------------|---------------------------------------------------|
| **VR Space**   | Name of the VR station (e.g., "VR 1")             |
| **Status**     | Availability status (Available/Occupied)          |
| **Game**       | Game being played at this station                 |
| **First Name** | First name of the attendee assigned               |
| **Last Name**  | Last name of the attendee assigned                |
| **Check-In Time** | Timestamp when the attendee started their session |
| **Duration**   | Duration of the VR session (calculated)           |

Additional Features:
- Color formatting for headers.
- Buttons for check-in, check-out, group check-in, and move from waitlist.
- Formula to calculate the number of people on the waitlist:  
  `=COUNTA(Waitlist!D:D) - 1`  
  Set to show red if more than 1 person is on the waitlist.

## 2. **Tracker Sheet**

Logs every check-in and check-out with details for each session.

| Column         | Description                                       |
|----------------|---------------------------------------------------|
| **Session ID** | Unique session identifier                         |
| **Unique ID**  | Unique ID for the attendee                        |
| **First Name** | First name of the attendee                        |
| **Last Name**  | Last name of the attendee                         |
| **VR Space**   | The VR station assigned to the attendee           |
| **Game**       | The game the attendee selected                    |
| **Check-In Time** | Timestamp when the attendee checked in          |
| **Check-Out Time** | Timestamp when the attendee checked out        |
| **Duration**   | Total time the attendee spent in VR               |

Prefilled formulas for:
- **Duration** columns to calculate time based on check-in and check-out times.
- Blanks filled with "N/A" for missing information like group numbers when not applicable.

## 3. **Legal Sheet**

Stores legal waiver and user consent details, imported from a Google Form.

| Column        | Description                                       |
|---------------|---------------------------------------------------|
| **Timestamp** | Time when the attendee submitted the form          |
| **First Name** | First name of the attendee                        |
| **Last Name** | Last name of the attendee                         |
| **Email**     | Attendee’s email address                          |
| **Consent**   | Whether the attendee agreed to the legal terms (Yes/No) |
| **Signature** | Attendee's electronic signature                   |

## 4. **Waitlist Sheet**

Tracks attendees waiting for an available VR space, including group and timing information.

| Column            | Description                                      |
|-------------------|--------------------------------------------------|
| **Session ID**     | Unique session identifier, corresponding to the attendee |
| **Group Number**   | Group number (if part of a group)               |
| **Group Leader**   | Name of the group leader (for group check-ins)  |
| **FName**          | First name of the attendee                      |
| **Phone Number**   | Phone number of the attendee (for notifications) |
| **Game**           | Game the attendee or group selected             |
| **WL Time**        | Time the attendee was added to the waitlist     |
| **Time Notified**  | Time when the attendee was notified of space availability |
| **Time Since Added**| Time since the attendee was added to the waitlist |
| **Time Since Notified** | Time since the attendee was notified        |

## 5. **VRSpaces Sheet**

Tracks all VR stations, their availability, and assigned attendees.

| Column         | Description                                       |
|----------------|---------------------------------------------------|
| **A: VR Space**         | Name of the VR station (e.g., "VR 1")             |
| **B: Supported Games**  | List of games supported by this VR space        |
| **C: Status**           | Availability status (Available/Occupied)         |
| **D: First Name**       | **First name** of the attendee assigned (only first name is recorded) |
| **E: Game**             | Game being played at this station                 |
| **F: Session ID**       | Unique session identifier for the attendee        |
| **G: Check-In Time**    | Timestamp when the attendee started their session |
| **H: Duration**         | Duration of the VR session (calculated)           |



### Additional Features:
- Color formatting for headers.
- Button to mark attendees as **No Show** or **Notified**.
