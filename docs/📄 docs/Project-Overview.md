# Project Overview

The **VR Zone Group Check-In System** is a Google Sheets-based system that allows event organizers to efficiently manage check-ins and session tracking for virtual reality (VR) stations. Designed for both individual attendees and groups, the system streamlines the process of assigning VR spaces, managing game selections, handling waitlists when stations are fully booked, and ensuring accurate data logging for reporting and analytics.

## 🏆 Goals

- **Efficient Check-In Process**: Provide a seamless flow for individual and group check-ins at VR stations.
- **Game and VR Space Assignment**: Automatically assign available VR spaces to attendees based on their game preferences.
- **Real-Time Tracking**: Log check-in and check-out times, calculate session durations, and track VR space usage.
- **Waitlist Management**: Place attendees or groups on a waitlist when no VR spaces are available and notify them when a space opens up.
- **Accurate Data Logging**: Ensure that attendee information, including first and last names, is accurately recorded for both individuals and groups.
- **Optimized Workflow**: Streamline functions to prevent duplicates and enhance system performance.
- **Analytics and Reporting**: Use Google Sheets for real-time reporting, with detailed data on VR space usage, player sessions, and more.

## ✨ Key Features

- **Group and Individual Check-In**: Allows both individual attendees and groups to check in, with each member assigned their own VR station and game.
- **Enhanced Waitlist Support**: Automatically adds attendees or groups to a waitlist if no spaces are available and efficiently assigns them once stations become free.
- **Improved Data Accuracy**: Captures and records both first and last names for all attendees, ensuring accurate session tracking.
- **Optimized Session Management**: Prevents duplicate entries in the Tracker sheet by updating existing records based on unique identifiers.
- **Customizable**: Event organizers can easily customize the list of games, VR spaces, and check-in workflows to suit their needs.
- **Automated Data Logging**: Logs all session details (check-in, check-out times, game selected, VR space used) in a Google Sheet for tracking and analytics.
- **Error Handling and Validation**: Improved error messages and validation checks to enhance user experience and data integrity.

## 🔧 How It Works

1. **Individual or Group Check-In**: Attendees can check in individually or as part of a group. For groups, each member's name is verified (including first and last names), and each is assigned to a VR station.
2. **Game Selection**: Attendees select a game from a predefined list, which can be customized by the event organizer.
3. **VR Space Assignment**: The system automatically finds and assigns available VR spaces based on the game selected by the attendee or group, preventing duplicate assignments.
4. **Waitlist Management**: If no VR spaces are available, the system places attendees or groups on a waitlist and assigns them a space when one opens up, ensuring they are correctly moved from the waitlist without creating duplicate entries.
5. **Session Logging**: Check-in and check-out times, along with session durations, are logged in the Google Sheets backend for reporting and analysis, with accurate recording of attendee details.
6. **No-Show Handling**: Allows event organizers to mark individuals or groups as no-shows, updating their status and removing them from the waitlist accordingly.
7. **Data Validation and Error Handling**: The system includes validation checks and informative error messages to guide users through the process and maintain data integrity.

## 🎯 Use Cases

- **Gaming Conventions**: Manage long queues for VR demos and experiences by tracking and organizing attendees' VR play sessions, with accurate group handling.
- **Corporate Events**: Streamline check-in for corporate VR experiences, ensuring efficient use of VR stations and accurate attendee tracking.
- **VR Arcades**: Automate the process of assigning VR stations and managing sessions in VR arcades or gaming centers, with optimized workflow and data logging.