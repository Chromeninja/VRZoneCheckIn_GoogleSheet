// File Name: Code.gs

// =========================
// Main Menu Creation
// =========================

function onOpen() { 
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('VR Zone')
    .addItem('Individual Check-In', 'checkIn')
    .addItem('Group Check-In', 'groupCheckIn')
    .addItem('Check-Out', 'checkOut')
    .addItem('Move from Waitlist to VR', 'moveFromWaitlistToVRSpace')
    .addItem('Mark as Notified', 'markAsNotified')
    .addItem('Mark as No Show', 'markAsNoShow')
    .addToUi();
}

// =========================
// Utility Functions
// =========================

/**
 * Generates a unique session ID based on the attendee's unique ID and current timestamp.
 * @param {string} uniqueId - The unique identifier of the attendee.
 * @returns {string} - The generated session ID.
 */
function generateSessionId(uniqueId) {
  var timestamp = new Date().getTime();
  return uniqueId + "-" + timestamp;
}

/**
 * Retrieves attendee information from the Legal sheet based on first and last name.
 * @param {string} firstName - The first name of the attendee.
 * @param {string} [lastName] - The last name of the attendee (optional).
 * @returns {Array} - An array of matching attendee objects.
 */
function getAttendeeInfo(firstName, lastName) {
  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal');
  var data = legalSheet.getDataRange().getValues();
  var matches = [];

  firstName = firstName.toLowerCase().trim();
  if (lastName) lastName = lastName.toLowerCase().trim();

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var sheetFirstName = data[i][3]; // Column D: First Name
    var sheetLastName = data[i][4];  // Column E: Last Name
    if (!sheetFirstName) continue;

    if (sheetFirstName.toString().trim().toLowerCase() === firstName) {
      if (lastName) {
        if (sheetLastName.toString().trim().toLowerCase() === lastName) {
          matches.push({
            uniqueId: data[i][16],
            firstName: data[i][3],
            lastName: data[i][4],
            phoneNumber: data[i][13],
            isMinor: data[i][5].toString().trim().toLowerCase() === 'yes',
            email: data[i][1],
            guardianFirstName: data[i][11],
            guardianLastName: data[i][12]
          });
        }
      } else {
        matches.push({
          uniqueId: data[i][16],
          firstName: data[i][3],
          lastName: data[i][4],
          phoneNumber: data[i][13],
          isMinor: data[i][5].toString().trim().toLowerCase() === 'yes',
          email: data[i][1],
          guardianFirstName: data[i][11],
          guardianLastName: data[i][12]
        });
      }
    }
  }

  return matches;
}

/**
 * Checks if a first name has duplicates in the Legal sheet.
 * @param {string} firstName - The first name to check for duplicates.
 * @returns {boolean} - True if duplicates exist, false otherwise.
 */
function checkDuplicateFirstName(firstName) {
  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal');
  var data = legalSheet.getDataRange().getValues();
  var count = 0;

  firstName = firstName.toLowerCase().trim();

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var legalFirstName = data[i][3];
    if (legalFirstName && legalFirstName.toString().trim().toLowerCase() === firstName) {
      count++;
      if (count > 1) return true;
    }
  }
  return false;
}

/**
 * Finds all available games from the VRSpaces sheet.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @returns {Array} - An array of unique supported games.
 */
function findAvailableGames(vrSheet) {
  var supportedGamesSet = new Set();
  var data = vrSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var supportedGames = data[i][1]; // Column B: Supported Games
    if (supportedGames) {
      supportedGames.split(',').forEach(function(game) {
        supportedGamesSet.add(game.trim());
      });
    }
  }

  var gamesArray = Array.from(supportedGamesSet);
  return gamesArray;
}

/**
 * Finds available VR spaces that support the selected game.
 * @param {string} selectedGame - The game for which VR spaces are being searched.
 * @param {Sheet} vrSheet - The sheet containing VR spaces and their statuses.
 * @returns {Array} - An array of available spaces for the selected game.
 */
function findAvailableSpacesForGame(selectedGame, vrSheet) {
  var data = vrSheet.getDataRange().getValues();
  var availableSpaces = [];

  for (var i = 1; i < data.length; i++) { // Assuming row 1 contains headers
    var status = data[i][2]; // Column C: VR Space Status (Available/Occupied)
    var supportedGames = data[i][1]; // Column B: Supported Games

    // Check if the space is available and supports the selected game
    if (status === 'Available' && supportedGames.includes(selectedGame)) {
      availableSpaces.push(data[i][0]); // Column A: VR Space Name
    }
  }

  return availableSpaces;
}

/**
 * Logs an error in the Tracker sheet based on session ID.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {string} sessionId - The session ID to log the error for.
 * @param {string} errorMessage - The error message to log.
 */
function setErrorFlag(trackerSheet, sessionId, errorMessage) {
  var data = trackerSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    if (data[i][0] === sessionId) {
      var rowToUpdate = i + 1;
      trackerSheet.getRange(rowToUpdate, 19).setValue(true); // Column S: Error Flag
      trackerSheet.getRange(rowToUpdate, 18).setValue(errorMessage); // Column R: Notes
      break;
    }
  }
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} - The capitalized string.
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =========================
// Individual Check-In Functions
// =========================

/**
 * Initiates the individual check-in process.
 */
function checkIn() {
  try {
    var attendee = getIndividualAttendeeInfo();
    if (!attendee) return;
    var sessionId = generateSessionId(attendee.uniqueId);
    promptForGameSelection(attendee, sessionId);
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-in: ' + error.message);
  }
}

/**
 * Retrieves attendee information for individual check-in with retry logic for incorrect names.
 * @returns {Object|null} - The attendee object or null if not found/cancelled.
 */
function getIndividualAttendeeInfo() {
  var ui = SpreadsheetApp.getUi();
  var firstNameResponse, firstName, lastName, matches;

  // Retry loop for first name
  while (true) {
    firstNameResponse = ui.prompt('Individual Check-In', 'Please enter the first name of the attendee:', ui.ButtonSet.OK_CANCEL);
    
    if (firstNameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }

    firstName = firstNameResponse.getResponseText().trim().toLowerCase();
    if (!firstName) {
      ui.alert('First name is required.');
      continue; // Retry entering first name
    }

    matches = getAttendeeInfo(firstName);

    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      // Retry loop for last name if multiple matches found
      while (matches.length > 1) {
        var lastNameResponse = ui.prompt('Multiple Matches Found', 'Multiple attendees found with the first name "' + capitalize(firstName) + '". Please enter the last name:', ui.ButtonSet.OK_CANCEL);
        
        if (lastNameResponse.getSelectedButton() !== ui.Button.OK) {
          ui.alert('Operation cancelled.');
          return null;
        }

        lastName = lastNameResponse.getResponseText().trim().toLowerCase();
        if (!lastName) {
          ui.alert('Last name is required.');
          continue; // Retry entering last name
        }

        matches = getAttendeeInfo(firstName, lastName);
      }

      if (matches.length === 1) {
        return matches[0];
      }
    }

    // If no matches are found, prompt the user to retry
    ui.alert('No attendee found with that first name. Please try again.');
  }
}

/**
 * Prompts the user to select a game from available games.
 * @param {Object} attendee - The attendee object.
 * @param {string} sessionId - The generated session ID.
 */
function promptForGameSelection(attendee, sessionId) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var supportedGames = findAvailableGames(vrSheet);
    if (supportedGames.length === 0) {
      SpreadsheetApp.getUi().alert('No supported games found.');
      return;
    }

    // Create HTML form for game selection
    var template = HtmlService.createTemplateFromFile('GameSelection');
    template.supportedGames = supportedGames;
    template.attendeeData = JSON.stringify(attendee);
    template.sessionId = sessionId;

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select Game');
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error in promptForGameSelection: ' + error.message);
  }
}

/**
 * Handles the game selection from the HTML dialog.
 * @param {string} selectedGame - The game selected by the user.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} sessionId - The session ID.
 */
function selectGame(selectedGame, attendeeDataJSON, sessionId) {
  try {
    var attendee = JSON.parse(attendeeDataJSON);
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');

    var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

    if (availableSpaces.length > 0) {
      // Prompt for VR space selection
      promptForVRSpaceSelection(availableSpaces, attendee, selectedGame, sessionId);
    } else {
      // If no spaces are available, add to waitlist
      addToWaitlist(attendee, selectedGame, sessionId);
      SpreadsheetApp.getUi().alert('No available VR spaces for ' + selectedGame + '. Attendee added to waitlist.');
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during game selection: ' + error.message);
  }
}

/**
 * Prompts the user to select a VR space from available spaces.
 * @param {Array} availableSpaces - Array of available VR space names.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function promptForVRSpaceSelection(availableSpaces, attendee, selectedGame, sessionId) {
  try {
    var template = HtmlService.createTemplateFromFile('VRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.attendeeData = JSON.stringify(attendee).replace(/'/g, "\\'");
    template.selectedGame = selectedGame;
    template.sessionId = sessionId;
    template.callbackFunction = 'selectVRSpace'; // Ensure this is set
    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select VR Space');
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error in promptForVRSpaceSelection: ' + error.message);
  }
}

/**
 * Handles the VR space selection from the HTML dialog.
 * @param {string} selectedSpace - The selected VR space.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function selectVRSpace(selectedSpace, attendeeDataJSON, selectedGame, sessionId) {
  try {
    var attendee = JSON.parse(attendeeDataJSON);
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    // The attendee is checked in, not waitlisted
    updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
    updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    SpreadsheetApp.getUi().alert('Attendee checked in to ' + selectedSpace + ' with game ' + selectedGame + '.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while assigning VR space: ' + error.message);
  }
}

/**
 * Updates the Tracker sheet for individual check-in and waitlist.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedSpace - The assigned VR space or 'Waitlist'.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The unique session ID for this attendee.
 * @param {boolean} isWaitlisted - Indicates if the attendee is added to the waitlist.
 */
function updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isWaitlisted) {
  var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
  var currentTime = new Date();
  var lastRow = trackerSheet.getLastRow() + 1;

  // Calculate Visit Count
  var data = trackerSheet.getDataRange().getValues();
  var visitCount = 1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === attendee.uniqueId) { // Column B: Unique ID
      var previousVisitCount = data[i][16]; // Column Q: Visit Count
      if (previousVisitCount && !isNaN(previousVisitCount)) {
        visitCount = Math.max(visitCount, parseInt(previousVisitCount) + 1);
      }
    }
  }

  // Determine session status
  var sessionStatus = isWaitlisted ? 'Waiting' : 'Active';
  var waitlistTime = isWaitlisted ? currentTime : '';
  var checkInTime = !isWaitlisted ? currentTime : '';

  // Append a new row in the Tracker sheet with individual details and use formulas for durations
  trackerSheet.appendRow([
    sessionId,                        // Column A: Session ID
    attendee.uniqueId || '',          // Column B: Unique ID
    attendee.firstName,               // Column C: First Name
    attendee.lastName || '',          // Column D: Last Name
    fullName,                         // Column E: Full Name
    groupLeaderFullName,              // Column F: Group Leader (Empty for individual)
    groupNumber || '',                // Column G: Group Number (Empty for individual)
    waitlistTime,                     // Column H: Waitlist Time
    checkInTime,                      // Column I: Check-In Time
    "",                               // Column J: Check-Out Time
    '=IF(H' + lastRow + '="","N/A",NOW()-H' + lastRow + ')', // Column K: Waitlist Duration Formula
    '=IF(I' + lastRow + '="","N/A",NOW()-I' + lastRow + ')', // Column L: Session Duration Formula
    '=IF(K' + lastRow + '="N/A", L' + lastRow + ', K' + lastRow + ')', // Column M: Total Duration Formula
    selectedGame,                     // Column N: Game
    selectedSpace,                    // Column O: VR Space or 'Waitlist'
    sessionStatus,                    // Column P: Session Status
    visitCount,                       // Column Q: Visit Count
    "",                               // Column R: Notes
    "",                               // Column S: Error Flag
    ""                                // Column T: No Show
  ]);

  var rowIndex = trackerSheet.getLastRow();
  trackerSheet.getRange(rowIndex, 11).setFormula('=IF(H' + rowIndex + '="","N/A",NOW()-H' + rowIndex + ')'); // Column K: Waitlist Duration
  trackerSheet.getRange(rowIndex, 12).setFormula('=IF(I' + rowIndex + '="","N/A",NOW()-I' + rowIndex + ')'); // Column L: Session Duration
  trackerSheet.getRange(rowIndex, 13).setFormula('=IF(K' + rowIndex + '="N/A", L' + rowIndex + ', K' + rowIndex + ')'); // Column M: Total Duration
}

/**
 * Updates the VRSpaces sheet to mark a VR space as occupied.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @param {string} selectedSpace - The selected VR space.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId) {
  var data = vrSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  // Find the row corresponding to the selected VR space
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === selectedSpace) { // Column A: VR Space
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate !== -1) {
    vrSheet.getRange(rowToUpdate, 3).setValue("Occupied");               // Column C: Status
    vrSheet.getRange(rowToUpdate, 4).setValue(attendee.firstName);        // Column D: First Name
    vrSheet.getRange(rowToUpdate, 5).setValue(selectedGame);              // Column E: Game
    vrSheet.getRange(rowToUpdate, 6).setValue(sessionId);                 // Column F: Session ID
    vrSheet.getRange(rowToUpdate, 7).setValue(new Date());                // Column G: Check-In Time
    // Column H: Duration remains untouched as per the requirement
  } else {
    throw new Error("VR Space not found: " + selectedSpace);
  }
}

// =========================
// Group Check-In Functions
// =========================

/* The Group Check-In functions were already provided in the previous response. */

// =========================
// Check-Out Functions
// =========================

/**
 * Initiates the check-out process by displaying a list of occupied VR spaces.
 */
function checkOut() {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var data = vrSheet.getDataRange().getValues();
    var occupiedSpaces = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][2] === 'Occupied') { // Column C: Status
        occupiedSpaces.push({
          space: data[i][0],          // Column A: VR Space
          firstName: data[i][3]       // Column D: First Name
        });
      }
    }

    if (occupiedSpaces.length === 0) {
      SpreadsheetApp.getUi().alert('No occupied VR spaces to check out.');
      return;
    }

    // Show the check-out selection dialog
    var template = HtmlService.createTemplateFromFile('CheckOutSelection');
    template.occupiedSpaces = occupiedSpaces;
    var htmlOutput = template.evaluate().setWidth(300).setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Check Out Attendees');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-out: ' + error.message);
  }
}

/**
 * Processes the check-out of selected VR spaces.
 * @param {Array} selectedSpaces - An array of VR space names to check out.
 */
function processCheckOut(selectedSpaces) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var checkOutTime = new Date();

    for (var i = 0; i < selectedSpaces.length; i++) {
      var space = selectedSpaces[i];
      // Update the Tracker sheet
      updateCheckOutTracker(trackerSheet, space, checkOutTime);
      // Free up the VR space
      freeVRSpace(vrSheet, space);
    }

    SpreadsheetApp.getUi().alert('Selected VR spaces have been checked out.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while processing check-out: ' + error.message);
  }
}

/**
 * Updates the Tracker sheet with check-out information.
 * @param {Sheet} trackerSheet - The Tracker sheet.
 * @param {string} space - The VR space being checked out.
 * @param {Date} checkOutTime - The check-out time.
 */
function updateCheckOutTracker(trackerSheet, space, checkOutTime) {
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][14] === space && !data[i][9]) { // Column O: VR Space, Column J: Check-Out Time
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate === -1) {
    throw new Error('No active session found for VR Space: ' + space);
  }

  trackerSheet.getRange(rowToUpdate, 10).setValue(checkOutTime); // Column J: Check-Out Time

  // Update formulas for durations
  trackerSheet.getRange(rowToUpdate, 12).setFormula('=I' + rowToUpdate + '-H' + rowToUpdate); // Column L: Session Duration
  trackerSheet.getRange(rowToUpdate, 13).setFormula('=J' + rowToUpdate + '-H' + rowToUpdate); // Column M: Total Duration

  trackerSheet.getRange(rowToUpdate, 16).setValue("Completed"); // Column P: Session Status
}

/**
 * Frees up a VR space by marking it as available and clearing attendee information.
 * @param {Sheet} vrSheet - The VRSpaces sheet.
 * @param {string} space - The VR space to free.
 */
function freeVRSpace(vrSheet, space) {
  var data = vrSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === space) { // Column A: VR Space
      vrSheet.getRange(i + 1, 3).setValue("Available"); // Column C: Status
      vrSheet.getRange(i + 1, 4, 1, 4).clearContent(); // Columns D-G: Clear attendee info
      // Column H: Duration remains untouched
      break;
    }
  }
}

// =========================
// Waitlist Management Functions
// =========================

/**
 * Adds an attendee to the waitlist.
 * @param {Object} attendee - The attendee object.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function addToWaitlist(attendee, selectedGame, sessionId) {
  var ui = SpreadsheetApp.getUi();
  var phoneNumber = attendee.phoneNumber || "";

  var promptMessage = phoneNumber
    ? 'Would you like to add ' + attendee.firstName + ' ' + attendee.lastName + ' to the waitlist?\n\nPhone Number: ' + phoneNumber + '\n\nClick Yes to confirm, No to enter a new number, or Cancel to cancel.'
    : 'Would you like to add ' + attendee.firstName + ' ' + attendee.lastName + ' to the waitlist?\n\nNo phone number found.\n\nClick Yes to enter a phone number, or Cancel to cancel.';

  var response = ui.alert('Add to Waitlist', promptMessage, ui.ButtonSet.YES_NO_CANCEL);

  if (response == ui.Button.YES && !phoneNumber) {
    phoneNumber = promptForPhoneNumber(ui);
  } else if (response == ui.Button.NO) {
    phoneNumber = promptForPhoneNumber(ui);
  } else if (response == ui.Button.CANCEL) {
    ui.alert('Submission canceled. Attendee was not added to the waitlist.');
    return;
  }

  if (!phoneNumber) return;
  var wlTime = new Date();
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var rowToAdd = waitlistSheet.getLastRow() + 1;

  waitlistSheet.appendRow([
    sessionId,                      // Column A: Session ID
    '',                             // Column B: Group Number (Empty for individual)
    '',                             // Column C: Group Leader (Empty for individual)
    attendee.firstName,             // Column D: First Name
    phoneNumber,                    // Column E: Phone Number
    selectedGame,                   // Column F: Game
    wlTime,                         // Column G: Waitlist Time
    '',                             // Column H: Time Notified
    '=NOW()-G' + (waitlistSheet.getLastRow() + 1), // Column I: Time Since Added
    ''                              // Column J: Time Since Notified
  ]);

  waitlistSheet.getRange(rowToAdd, 9).setFormula('=NOW()-G' + rowToAdd); // Column I: Time Since Added

  // Update tracker sheet
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  updateCheckInTracker(trackerSheet, attendee, 'Waitlist', selectedGame, sessionId, true);

  ui.alert('Attendee ' + attendee.firstName + ' ' + attendee.lastName + ' has been successfully added to the waitlist.');
}

/**
 * Prompts the user to enter a phone number.
 * @param {UI} ui - The Spreadsheet UI instance.
 * @returns {string|null} - The entered phone number or null if cancelled.
 */
function promptForPhoneNumber(ui) {
  var phoneResponse = ui.prompt('Enter Phone Number', 'Please enter the attendee\'s phone number:', ui.ButtonSet.OK_CANCEL);
  if (phoneResponse.getSelectedButton() == ui.Button.OK) {
    var phoneNumber = phoneResponse.getResponseText().trim();
    if (!phoneNumber) {
      ui.alert('Phone number is required to add to the waitlist.');
      return null;
    }
    return phoneNumber;
  } else {
    ui.alert('Phone number is required to add to the waitlist.');
    return null;
  }
}

/**
 * Initiates the process to move an attendee from the waitlist to a VR space.
 */
function moveFromWaitlistToVRSpace() {
  try {
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var waitlistEntries = getWaitlistEntries(waitlistSheet);

    if (waitlistEntries.length === 0) {
      SpreadsheetApp.getUi().alert("No attendees are currently on the waitlist.");
      return;
    }

    // Create HTML form for waitlist selection
    var template = HtmlService.createTemplateFromFile('WaitlistSelection');
    template.waitlistEntries = waitlistEntries;
    template.title = 'Select Attendee to Move from Waitlist';
    template.buttonLabel = 'Assign VR Space';
    template.callbackFunction = 'processMoveFromWaitlist';

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Move Attendee from Waitlist');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while moving from waitlist: ' + error.message);
  }
}

/**
 * Processes moving an attendee from the waitlist to a VR space.
 * @param {string} selectedSessionId - The session ID of the attendee selected from the waitlist.
 */
function processMoveFromWaitlist(selectedSessionId) {
  try {
    var ui = SpreadsheetApp.getUi();
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    // Find the waitlist entry
    var waitlistData = waitlistSheet.getDataRange().getValues();
    var selectedEntry = null;

    for (var i = 1; i < waitlistData.length; i++) {
      if (waitlistData[i][0] === selectedSessionId) { // Column A: Session ID
        selectedEntry = {
          sessionId: waitlistData[i][0],       // Column A: Session ID
          firstName: waitlistData[i][3],       // Column D: First Name
          phoneNumber: waitlistData[i][4],     // Column E: Phone Number
          game: waitlistData[i][5],            // Column F: Game
          wlTime: waitlistData[i][6],          // Column G: Waitlist Time
          rowIndex: i + 1
        };
        break;
      }
    }

    if (!selectedEntry) {
      ui.alert('Attendee not found on the waitlist.');
      return;
    }

    // Find available spaces for the attendee's game
    var availableSpaces = findAvailableSpacesForGame(selectedEntry.game, vrSheet);

    if (availableSpaces.length === 0) {
      ui.alert("No available VR spaces for the game: " + selectedEntry.game);
      return;
    }

    // Prompt for VR space selection
    var template = HtmlService.createTemplateFromFile('VRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.attendeeData = JSON.stringify({
      uniqueId: '', // Adjust if uniqueId is stored elsewhere
      firstName: selectedEntry.firstName,
      lastName: '', // Adjust if last name is available
      phoneNumber: selectedEntry.phoneNumber
    }).replace(/'/g, "\\'");
    template.selectedGame = selectedEntry.game;
    template.sessionId = selectedEntry.sessionId;
    template.callbackFunction = 'finalizeMoveFromWaitlist';

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Assign VR Space');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while processing move from waitlist: ' + error.message);
  }
}

/**
 * Finalizes moving an attendee from the waitlist to a VR space.
 * @param {string} selectedSpace - The selected VR space.
 * @param {string} attendeeDataJSON - JSON string of attendee data.
 * @param {string} selectedGame - The selected game.
 * @param {string} sessionId - The session ID.
 */
function finalizeMoveFromWaitlist(selectedSpace, attendeeDataJSON, selectedGame, sessionId) {
  try {
    var attendee = JSON.parse(attendeeDataJSON);

    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');

    // Update Tracker Sheet
    updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
    updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    removeFromWaitlist(waitlistSheet, sessionId);

    SpreadsheetApp.getUi().alert('Attendee assigned to ' + selectedSpace + ' with game ' + selectedGame + '.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while finalizing move from waitlist: ' + error.message);
  }
}

/**
 * Retrieves all waitlist entries.
 * @param {Sheet} waitlistSheet - The Waitlist sheet.
 * @returns {Array} - Array of waitlist entries.
 */
function getWaitlistEntries(waitlistSheet) {
  var data = waitlistSheet.getDataRange().getValues();
  var entries = [];

  for (var i = 1; i < data.length; i++) {
    entries.push({
      sessionId: data[i][0],   // Column A: Session ID
      firstName: data[i][3],   // Column D: First Name
      phoneNumber: data[i][4], // Column E: Phone Number
      game: data[i][5],        // Column F: Game
      wlTime: data[i][6],      // Column G: Waitlist Time
      rowIndex: i + 1
    });
  }
  return entries;
}

/**
 * Removes an attendee from the waitlist based on session ID.
 * @param {Sheet} waitlistSheet - The Waitlist sheet.
 * @param {string} sessionId - The session ID to remove.
 */
function removeFromWaitlist(waitlistSheet, sessionId) {
  var data = waitlistSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      waitlistSheet.deleteRow(i + 1);
      break;
    }
  }
}

// =========================
// Mark as Notified Functions
// =========================

/**
 * Initiates the process to mark an attendee on the waitlist as notified.
 */
function markAsNotified() {
  try {
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var waitlistEntries = getWaitlistEntries(waitlistSheet);

    if (waitlistEntries.length === 0) {
      SpreadsheetApp.getUi().alert("No attendees are currently on the waitlist.");
      return;
    }

    var template = HtmlService.createTemplateFromFile('WaitlistSelection');
    template.waitlistEntries = waitlistEntries;
    template.title = 'Select Attendee to Mark as Notified';
    template.buttonLabel = 'Mark as Notified';
    template.callbackFunction = 'processMarkAsNotified';

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Mark Attendee as Notified');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while marking as notified: ' + error.message);
  }
}

/**
 * Processes marking an attendee as notified.
 * @param {string} selectedSessionId - The session ID of the attendee to mark as notified.
 */
function processMarkAsNotified(selectedSessionId) {
  try {
    var ui = SpreadsheetApp.getUi();
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var data = waitlistSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === selectedSessionId) { // Column A: Session ID
        var rowIndex = i + 1;
        waitlistSheet.getRange(rowIndex, 8).setValue(new Date()); // Column H: Time Notified
        waitlistSheet.getRange(rowIndex, 10).setFormula('=NOW()-H' + rowIndex); // Column J: Time Since Notified
        ui.alert('Attendee has been marked as notified.');
        return;
      }
    }

    ui.alert('Attendee not found on the waitlist.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while processing mark as notified: ' + error.message);
  }
}

// =========================
// Mark as No Show Functions
// =========================

/**
 * Initiates the process to mark an attendee as a no-show.
 */
function markAsNoShow() {
  try {
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var data = trackerSheet.getDataRange().getValues();
    var waitingAttendees = [];

    for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
      if (data[i][15] === "Waiting") { // Column P: Session Status
        waitingAttendees.push({
          sessionId: data[i][0],     // Column A: Session ID
          firstName: data[i][2],     // Column C: First Name
          lastName: data[i][3]       // Column D: Last Name
        });
      }
    }

    if (waitingAttendees.length === 0) {
      SpreadsheetApp.getUi().alert('No attendees marked as "Waiting" in the Tracker.');
      return;
    }

    var template = HtmlService.createTemplateFromFile('NoShowSelection');
    template.waitingAttendees = waitingAttendees;

    var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Mark Attendee as No Show');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while marking as no show: ' + error.message);
  }
}

/**
 * Processes marking an attendee as a no-show.
 * @param {string} selectedSessionId - The session ID of the attendee to mark as no-show.
 */
function processMarkAsNoShow(selectedSessionId) {
  try {
    var ui = SpreadsheetApp.getUi();
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
    var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
    var data = trackerSheet.getDataRange().getValues();
    var rowToUpdate = -1;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === selectedSessionId && data[i][15] === "Waiting") { // Column A and P
        rowToUpdate = i + 1;
        break;
      }
    }

    if (rowToUpdate === -1) {
      ui.alert('Invalid Session ID or attendee is not in "Waiting" status.');
      return;
    }

    // Update Tracker Sheet
    trackerSheet.getRange(rowToUpdate, 20).setValue(true);       // Column T: No Show Flag
    trackerSheet.getRange(rowToUpdate, 16).setValue("No Show");  // Column P: Session Status

    // Remove from Waitlist Sheet
    removeFromWaitlist(waitlistSheet, selectedSessionId);

    ui.alert('Attendee has been marked as No Show and removed from the waitlist.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred while processing mark as no show: ' + error.message);
  }
}