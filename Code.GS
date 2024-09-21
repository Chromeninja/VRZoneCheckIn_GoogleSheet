// File Name: Code.gs

// =========================
// Main Menu Creation - 1
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

function generateSessionID(uniqueId) {
  var timestamp = new Date().getTime();
  return uniqueId + "-" + timestamp;
}

function getAttendeeInfo() {
  var ui = SpreadsheetApp.getUi();
  var firstNameResponse = ui.prompt('Check-In', 'Please enter the first name of the attendee:', ui.ButtonSet.OK_CANCEL);

  if (firstNameResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operation cancelled.');
    return null;
  }

  var firstName = firstNameResponse.getResponseText().trim().toLowerCase();

  if (!firstName) {
    ui.alert('First name is required.');
    return null;
  }

  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal');
  var data = legalSheet.getDataRange().getValues();
  var matches = [];

  for (var i = 1; i < data.length; i++) {
    var sheetFirstName = data[i][3];
    if (sheetFirstName && sheetFirstName.toString().trim().toLowerCase() === firstName) {
      matches.push({
        uniqueId: data[i][16],
        firstName: data[i][3],
        lastName: data[i][4],
        phoneNumber: data[i][13],
        isMinor: data[i][5] === 'Yes',
        email: data[i][1],
        guardianFirstName: data[i][11],
        guardianLastName: data[i][12]
      });
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    var lastNameResponse = ui.prompt('Check-In', 'Multiple attendees found with the same first name. Please enter the last name:', ui.ButtonSet.OK_CANCEL);

    if (lastNameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return null;
    }

    var lastName = lastNameResponse.getResponseText().trim().toLowerCase();

    if (!lastName) {
      ui.alert('Last name is required.');
      return null;
    }

    for (var i = 0; i < matches.length; i++) {
      if (matches[i].lastName.trim().toLowerCase() === lastName) {
        return matches[i];
      }
    }
    ui.alert('No attendee found with that first and last name.');
    return null;
  }

  ui.alert('No attendee found with that first name.');
  return null;
}

function findAvailableGames(vrSheet) {
  var supportedGamesSet = new Set();
  var data = vrSheet.getDataRange().getValues();

  Logger.log("VRSpaces Data Length: " + data.length);

  for (var i = 1; i < data.length; i++) {
    var supportedGames = data[i][1];
    Logger.log("Row " + (i + 1) + " Supported Games: " + supportedGames);
    if (supportedGames) {
      supportedGames.split(',').forEach(function(game) {
        supportedGamesSet.add(game.trim());
      });
    }
  }

  var gamesArray = Array.from(supportedGamesSet);
  Logger.log("Supported Games Found: " + gamesArray);
  return gamesArray;
}


function findAvailableSpacesForGame(game, vrSheet) {
  var data = vrSheet.getDataRange().getValues();
  var availableSpaces = [];

  for (var i = 1; i < data.length; i++) {
    var vrSpace = data[i][0];
    var supportedGames = data[i][1];
    var status = data[i][2];

    if (status === "Available" && supportedGames) {
      var gamesList = supportedGames.split(',').map(function(s) { return s.trim(); });
      if (gamesList.includes(game)) {
        availableSpaces.push(vrSpace);
      }
    }
  }
  return availableSpaces;
}

function setErrorFlag(trackerSheet, sessionId, errorMessage) {
  var data = trackerSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      var rowToUpdate = i + 1;
      trackerSheet.getRange(rowToUpdate, 19).setValue(true); // Error Flag in Column S
      trackerSheet.getRange(rowToUpdate, 18).setValue(errorMessage); // Notes in Column R
      break;
    }
  }
}

// =========================
// Check-In Functions
// =========================

function checkIn() {
  try {
    var attendee = getAttendeeInfo(); // Get attendee info
    if (!attendee) return;

    // Generate Session ID
    var sessionId = generateSessionID(attendee.uniqueId);

    // Prompt for game selection
    promptForGameDropdown(attendee, sessionId);
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-in: ' + error.message);
  }
}

function promptForGameDropdown(attendee, sessionId) {
  try {
    Logger.log('Entered promptForGameDropdown');
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var supportedGames = findAvailableGames(vrSheet);

    Logger.log("Supported Games: " + supportedGames);

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
    SpreadsheetApp.getUi().alert('Error in promptForGameDropdown: ' + error.message);
    Logger.log('Error in promptForGameDropdown: ' + error.stack);
  }
}



function selectGame(selectedGame, attendeeDataJSON, sessionId) {
  var attendee = JSON.parse(attendeeDataJSON);
  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');

  var availableSpaces = findAvailableSpacesForGame(selectedGame, vrSheet);

  if (availableSpaces.length > 0) {
    // Prompt for VR space selection
    promptForVRSpaceDropdown(availableSpaces, attendee, selectedGame, sessionId);
  } else {
    // If no spaces are available, add to waitlist
    addToWaitlist(attendee, selectedGame, sessionId);
    SpreadsheetApp.getUi().alert('No available VR spaces for ' + selectedGame + '. Attendee added to waitlist.');
  }
}

function promptForVRSpaceDropdown(availableSpaces, attendee, selectedGame, sessionId) {
  var template = HtmlService.createTemplateFromFile('VRSpaceSelection');
  template.availableSpaces = availableSpaces;
  template.attendeeData = JSON.stringify(attendee).replace(/'/g, "\\'");
  template.selectedGame = selectedGame;
  template.sessionId = sessionId;
  template.callbackFunction = 'selectVRSpace'; // Ensure this is set

  var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Select VR Space');
}


function selectVRSpace(selectedSpace, attendeeDataJSON, selectedGame, sessionId) {
  var attendee = JSON.parse(attendeeDataJSON);

  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

  // Update the VRSpaces sheet and Tracker with the selected space and session information
  updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
  updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);

  SpreadsheetApp.getUi().alert('Attendee checked in to ' + selectedSpace + ' with game ' + selectedGame + '.');
}


// =========================
// Group Check-In Functions
// =========================

function groupCheckIn() {
  var ui = SpreadsheetApp.getUi();
  try {
    // Prompt for the number of people in the group
    var groupSizeResponse = ui.prompt('Group Check-In', 'Enter the number of people in the group:', ui.ButtonSet.OK_CANCEL);
    if (groupSizeResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return;
    }

    var groupSize = parseInt(groupSizeResponse.getResponseText());
    if (isNaN(groupSize) || groupSize <= 0) {
      ui.alert('Invalid group size.');
      return;
    }

    // Prompt for the group leader's first name
    var groupLeaderResponse = ui.prompt('Group Check-In', 'Enter the first name of the group leader:', ui.ButtonSet.OK_CANCEL);
    if (groupLeaderResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Operation cancelled.');
      return;
    }

    var groupLeaderFirstName = groupLeaderResponse.getResponseText().trim();
    if (!groupLeaderFirstName) {
      ui.alert('Group leader\'s first name is required.');
      return;
    }

    // Check for duplicate first names
    var duplicates = checkDuplicateFirstNames(groupLeaderFirstName);
    var groupLeaderLastName = '';
    if (duplicates) {
      var groupLeaderLastNameResponse = ui.prompt('Group Check-In', 'Multiple attendees found with the first name "' + groupLeaderFirstName + '". Please enter the last name of the group leader:', ui.ButtonSet.OK_CANCEL);
      if (groupLeaderLastNameResponse.getSelectedButton() !== ui.Button.OK) {
        ui.alert('Operation cancelled.');
        return;
      }
      groupLeaderLastName = groupLeaderLastNameResponse.getResponseText().trim();
      if (!groupLeaderLastName) {
        ui.alert('Group leader\'s last name is required.');
        return;
      }
    }

    // Collect group member names
    var groupMembers = [];
    groupMembers.push({
      firstName: groupLeaderFirstName,
      lastName: groupLeaderLastName,
      isLeader: true
    });

    for (var i = 2; i <= groupSize; i++) {
      var memberFirstNameResponse = ui.prompt('Group Check-In', 'Enter the first name of group member ' + i + ':', ui.ButtonSet.OK_CANCEL);
      if (memberFirstNameResponse.getSelectedButton() !== ui.Button.OK) {
        ui.alert('Operation cancelled.');
        return;
      }

      var memberFirstName = memberFirstNameResponse.getResponseText().trim();
      if (!memberFirstName) {
        ui.alert('Group member ' + i + '\'s first name is required.');
        return;
      }

      // Check for duplicate first names
      var memberDuplicates = checkDuplicateFirstNames(memberFirstName);
      var memberLastName = '';
      if (memberDuplicates) {
        var memberLastNameResponse = ui.prompt('Group Check-In', 'Multiple attendees found with the first name "' + memberFirstName + '". Please enter the last name of group member ' + i + ':', ui.ButtonSet.OK_CANCEL);
        if (memberLastNameResponse.getSelectedButton() !== ui.Button.OK) {
          ui.alert('Operation cancelled.');
          return;
        }
        memberLastName = memberLastNameResponse.getResponseText().trim();
        if (!memberLastName) {
          ui.alert('Group member ' + i + '\'s last name is required.');
          return;
        }
      }

      groupMembers.push({
        firstName: memberFirstName,
        lastName: memberLastName,
        isLeader: false
      });
    }

    // Store group information in script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('groupSize', groupSize.toString());
    scriptProperties.setProperty('groupLeaderFirstName', groupLeaderFirstName);
    scriptProperties.setProperty('groupLeaderLastName', groupLeaderLastName);
    scriptProperties.setProperty('groupMembers', JSON.stringify(groupMembers));

    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var supportedGames = findAvailableGames(vrSheet);

    if (supportedGames.length === 0) {
      ui.alert('No supported games found.');
      return;
    }

    // Prompt for game selection
    var gameSelectionTemplate = HtmlService.createTemplateFromFile('GameSelectionGroup');
    gameSelectionTemplate.supportedGames = supportedGames;

    var gameHtmlOutput = gameSelectionTemplate.evaluate().setWidth(300).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(gameHtmlOutput, 'Select Game for Group');

  } catch (error) {
    ui.alert('An error occurred during group check-in: ' + error.message);
  }
}

function getAvailableVRSpaces(vrSheet) {
  var data = vrSheet.getDataRange().getValues();
  var availableSpaces = [];

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var status = data[i][2].toString().trim().toLowerCase(); // Column C: Status
    var vrSpace = data[i][0].toString().trim(); // Column A: VR Space
    var attendeeFirstName = data[i][3].toString().trim(); // Column D: FName

    if (status === "available") {
      availableSpaces.push({
        space: vrSpace,
        firstName: attendeeFirstName || "Available"
      });
    }
  }

  return availableSpaces;
}

function verifyAttendee(firstName, lastName) {
  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal'); // Replace with your actual sheet name
  var data = legalSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var legalFirstName = data[i][0].toString().trim().toLowerCase(); // Column A: First Name
    var legalLastName = data[i][1].toString().trim().toLowerCase(); // Column B: Last Name

    if (legalFirstName === firstName.toLowerCase() && legalLastName === lastName.toLowerCase()) {
      return true; // Valid attendee
    }
  }

  return false; // Attendee not found or invalid
}
function checkDuplicateFirstName(firstName) {
  var legalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Legal'); // Replace with your actual sheet name
  var data = legalSheet.getDataRange().getValues();
  var count = 0;

  for (var i = 1; i < data.length; i++) { // Assuming the first row is headers
    var legalFirstName = data[i][0].toString().trim().toLowerCase(); // Column A: First Name

    if (legalFirstName === firstName.toLowerCase()) {
      count++;
      if (count > 1) {
        return true; // Duplicate first name found
      }
    }
  }

  return false; // No duplicates
}


function proceedGroupCheckIn(selectedGame) {
  var ui = SpreadsheetApp.getUi();
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    // Retrieve group information from script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var groupSize = parseInt(scriptProperties.getProperty('groupSize'));
    var groupLeaderFirstName = scriptProperties.getProperty('groupLeaderFirstName');
    var groupLeaderLastName = scriptProperties.getProperty('groupLeaderLastName');
    var groupMembers = JSON.parse(scriptProperties.getProperty('groupMembers'));
    scriptProperties.deleteAllProperties(); // Clean up

    var groupNumber = new Date().getTime(); // Unique group identifier

    var availableSpaces = getAvailableVRSpaces(vrSheet);

    if (availableSpaces.length < groupSize) {
      ui.alert('Not enough VR spaces available for the group.');
      return;
    }

    // Prompt to select multiple VR spaces
    var template = HtmlService.createTemplateFromFile('GroupVRSpaceSelection');
    template.availableSpaces = availableSpaces;
    template.groupSize = groupSize;
    template.groupMembers = JSON.stringify(groupMembers);
    template.selectedGame = selectedGame;
    template.groupNumber = groupNumber;

    var htmlOutput = template.evaluate().setWidth(400).setHeight(300);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Assign VR Spaces to Group');
  } catch (error) {
    ui.alert('An error occurred during group check-in: ' + error.message);
  }
}


function updateCheckInTrackerGroup(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isLeader, groupNumber) {
  var fullName = attendee.firstName + ' ' + (attendee.lastName || '');
  var currentTime = new Date();

  // Calculate Visit Count
  var data = trackerSheet.getDataRange().getValues();
  var visitCount = 1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === attendee.uniqueId) {
      var previousVisitCount = data[i][16];
      if (previousVisitCount && !isNaN(previousVisitCount)) {
        visitCount = Math.max(visitCount, parseInt(previousVisitCount) + 1);
      }
    }
  }

  trackerSheet.appendRow([
    sessionId,                     // Column A: Session ID
    attendee.uniqueId || '',       // Column B: Unique ID
    attendee.firstName,            // Column C: First Name
    attendee.lastName || '',       // Column D: Last Name
    fullName,                      // Column E: Full Name
    isLeader ? attendee.firstName : "", // Column F: Group Leader
    groupNumber,                   // Column G: Group No.
    "",                            // Column H: WL Time
    currentTime,                   // Column I: Check-In Time
    "",                            // Column J: Check-Out Time
    "",                            // Column K: Waitlist Duration
    "",                            // Column L: Session Duration
    "",                            // Column M: Total Duration
    selectedGame,                  // Column N: Game
    selectedSpace,                 // Column O: VR Space
    "Active",                      // Column P: Session Status
    visitCount,                    // Column Q: Visit Count
    "",                            // Column R: Notes
    "",                            // Column S: Error Flag
    ""                             // Column T: No Show
  ]);
}

function assignVRSpacesToGroup(selectedSpaces, selectedGame, groupNumber, groupMembersJSON) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    var groupMembers = JSON.parse(groupMembersJSON);
    var checkInTime = new Date();

    if (selectedSpaces.length < groupMembers.length) {
      SpreadsheetApp.getUi().alert('Number of selected VR spaces is less than the number of group members.');
      return;
    }

    for (var i = 0; i < groupMembers.length; i++) {
      var attendee = groupMembers[i];
      var sessionId = generateSessionID(attendee.uniqueId || ''); // Adjust if uniqueId is stored elsewhere

      var selectedSpace = selectedSpaces[i];

      // Update the Tracker and VRSpaces
      updateCheckInTrackerGroup(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, attendee.isLeader, groupNumber);
      updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
    }

    SpreadsheetApp.getUi().alert('Group check-in completed successfully.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during group check-in: ' + error.message);
  }
}
function checkDuplicateFirstNames(firstName) {
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var data = trackerSheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][2].toLowerCase() === firstName.toLowerCase()) { // Column C: First Name
      count++;
      if (count > 1) {
        return true;
      }
    }
  }
  return false;
}

// =========================
// Update Functions
// =========================

function updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, isFromWaitlist) {
  var data = trackerSheet.getDataRange().getValues();
  var trackerRowToUpdate = -1;

  // Check if the Session ID already exists
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      trackerRowToUpdate = i + 1;
      break;
    }
  }

  var fullName = attendee.firstName + ' ' + attendee.lastName;
  var currentTime = new Date();

  if (trackerRowToUpdate !== -1) {
    // Update existing row
    trackerSheet.getRange(trackerRowToUpdate, 9).setValue(currentTime); // Check-In Time
    trackerSheet.getRange(trackerRowToUpdate, 14).setValue(selectedGame); // Game
    trackerSheet.getRange(trackerRowToUpdate, 15).setValue(selectedSpace); // VR Space
    trackerSheet.getRange(trackerRowToUpdate, 16).setValue("Active"); // Session Status

    // Update Visit Count
    var previousVisitCount = data[trackerRowToUpdate - 1][16];
    var visitCount = previousVisitCount ? parseInt(previousVisitCount) + 1 : 1;
    trackerSheet.getRange(trackerRowToUpdate, 17).setValue(visitCount);

  } else {
    // Calculate Visit Count
    var visitCount = 1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === attendee.uniqueId) {
        var previousVisitCount = data[i][16];
        if (previousVisitCount && !isNaN(previousVisitCount)) {
          visitCount = Math.max(visitCount, parseInt(previousVisitCount) + 1);
        }
      }
    }

    trackerSheet.appendRow([
      sessionId,
      attendee.uniqueId,
      attendee.firstName,
      attendee.lastName,
      fullName,
      "", // Group Leader
      "", // Group No.
      isFromWaitlist ? currentTime : "", // WL Time
      isFromWaitlist ? "" : currentTime, // Check-In Time
      "", // Check-Out Time
      "", // Waitlist Duration
      "", // Session Duration
      "", // Total Duration
      selectedGame,
      selectedSpace,
      isFromWaitlist ? "Waiting" : "Active",
      visitCount,
      "", // Notes
      "", // Error Flag
      ""  // No Show
    ]);
  }
}

function updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId) {
  var data = vrSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === selectedSpace) { // Column A: VR Space
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate !== -1) {
    vrSheet.getRange(rowToUpdate, 3).setValue("Occupied"); // Column C: Status
    vrSheet.getRange(rowToUpdate, 4).setValue(attendee.firstName); // Column D: FName
    vrSheet.getRange(rowToUpdate, 5).setValue(selectedGame); // Column E: Game
    vrSheet.getRange(rowToUpdate, 6).setValue(sessionId); // Column F: Session ID
    vrSheet.getRange(rowToUpdate, 7).setValue(new Date()); // Column G: Check-In Time
    // Column H: Duration remains untouched
  } else {
    throw new Error("VR Space not found: " + selectedSpace);
  }
}

// =========================
// Check-Out Functions
// =========================

function checkOut() {
  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var occupiedSpaces = getOccupiedSpacesWithNames(vrSheet);

  if (occupiedSpaces.length === 0) {
    SpreadsheetApp.getUi().alert("No occupied VR spaces available for checkout.");
    return;
  }

  var template = HtmlService.createTemplateFromFile('CheckOutSelection');
  template.occupiedSpaces = occupiedSpaces;

  var htmlOutput = template.evaluate().setWidth(300).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Check Out Attendees');
}

function getOccupiedSpacesWithNames(vrSheet) {
  var data = vrSheet.getDataRange().getValues();
  var occupiedSpaces = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === "Occupied") { // Column C: Status
      occupiedSpaces.push({
        space: data[i][0],        // Column A: VR Space
        firstName: data[i][3]     // Column D: FName
      });
    }
  }

  return occupiedSpaces;
}

function processCheckOut(selectedSpaces) {
  try {
    var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
    var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

    var checkOutTime = new Date();

    for (var i = 0; i < selectedSpaces.length; i++) {
      var selectedSpace = selectedSpaces[i];
      updateCheckOutTracker(trackerSheet, selectedSpace, checkOutTime);
      freeVRSpace(vrSheet, selectedSpace);
    }

    SpreadsheetApp.getUi().alert('Selected attendees have been checked out.');
  } catch (error) {
    SpreadsheetApp.getUi().alert('An error occurred during check-out: ' + error.message);
  }
}


function getOccupiedSpaces(vrSheet) {
  var data = vrSheet.getDataRange().getValues(); // Get the range containing VR spaces
  var occupiedSpaces = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === "Occupied") { // Check if the status is "Occupied"
      occupiedSpaces.push(data[i][0]); // Add the VR space name (Column A)
    }
  }

  return occupiedSpaces;
}

function updateCheckOutTracker(trackerSheet, space, checkOutTime) {
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][14] === space && data[i][9] === "") { // VR Space and Check-Out Time is empty
      rowToUpdate = i + 1;
      break;
    }
  }

  if (rowToUpdate === -1) {
    throw new Error('No active session found for VR Space: ' + space);
  }

  trackerSheet.getRange(rowToUpdate, 10).setValue(checkOutTime); // Check-Out Time

  var checkInTime = data[rowToUpdate - 1][8];
  var wlTime = data[rowToUpdate - 1][7];

  if (checkInTime instanceof Date) {
    var sessionDuration = (checkOutTime - checkInTime) / (1000 * 60);
    trackerSheet.getRange(rowToUpdate, 12).setValue(sessionDuration); // Session Duration
  } else {
    trackerSheet.getRange(rowToUpdate, 19).setValue(true); // Error Flag
    trackerSheet.getRange(rowToUpdate, 18).setValue('Invalid Check-In Time'); // Notes
  }

  if (wlTime instanceof Date) {
    var waitlistDuration = (checkInTime - wlTime) / (1000 * 60);
    trackerSheet.getRange(rowToUpdate, 11).setValue(waitlistDuration); // Waitlist Duration

    var totalDuration = (checkOutTime - wlTime) / (1000 * 60);
    trackerSheet.getRange(rowToUpdate, 13).setValue(totalDuration); // Total Duration
  } else {
    trackerSheet.getRange(rowToUpdate, 13).setValue(sessionDuration); // Total Duration
  }

  trackerSheet.getRange(rowToUpdate, 16).setValue("Completed"); // Session Status
}

function freeVRSpace(vrSheet, space) {
  var data = vrSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === space) { // Column A: VR Space
      var rowToUpdate = i + 1;
      vrSheet.getRange(rowToUpdate, 3).setValue("Available"); // Column C: Status
      vrSheet.getRange(rowToUpdate, 4, 1, 4).clearContent(); // Columns D-G: Clear attendee info
      // Column H: Duration remains untouched
      break;
    }
  }
}

// =========================
// Waitlist Functions
// =========================

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
  waitlistSheet.appendRow([
    sessionId,            // Column A: SessionID
    attendee.firstName,   // Column B: FName
    phoneNumber,          // Column C: Phone Number
    selectedGame,         // Column D: Game
    wlTime,               // Column E: WL Time
    "",                   // Column F: Time Notified
    "",                   // Column G: Time Since Added
    "",                   // Column H: Time Since Notified
    ""                    // Column I: Group No.
  ]);

  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  updateCheckInTracker(trackerSheet, attendee, "", selectedGame, sessionId, true);

  ui.alert('Attendee ' + attendee.firstName + ' ' + attendee.lastName + ' has been successfully added to the waitlist.');
}


function promptForPhoneNumber(ui) {
  var phoneResponse = ui.prompt('Enter Phone Number', 'Please enter the attendee\'s phone number:', ui.ButtonSet.OK_CANCEL);
  if (phoneResponse.getSelectedButton() == ui.Button.OK) {
    var phoneNumber = phoneResponse.getResponseText();
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

function moveFromWaitlistToVRSpace() {
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
}

function processMoveFromWaitlist(selectedSessionId) {
  var ui = SpreadsheetApp.getUi();
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');

  // Find the waitlist entry
  var waitlistData = waitlistSheet.getDataRange().getValues();
  var selectedEntry = null;

  for (var i = 1; i < waitlistData.length; i++) {
    if (waitlistData[i][0] === selectedSessionId) { // Column A: SessionID
      selectedEntry = {
        sessionId: waitlistData[i][0],       // Column A: SessionID
        firstName: waitlistData[i][1],       // Column B: FName
        phoneNumber: waitlistData[i][2],     // Column C: Phone Number
        game: waitlistData[i][3],            // Column D: Game
        wlTime: waitlistData[i][4],          // Column E: WL Time
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
  ui.showModalDialog(htmlOutput, 'Assign VR Space');
}


function finalizeMoveFromWaitlist(selectedSpace, attendeeDataJSON, selectedGame, sessionId) {
  var attendee = JSON.parse(attendeeDataJSON);

  var vrSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VRSpaces');
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');

  // Update the VRSpaces sheet and Tracker with the selected space and session information
  updateCheckInTracker(trackerSheet, attendee, selectedSpace, selectedGame, sessionId, false);
  updateVRSpaces(vrSheet, selectedSpace, attendee, selectedGame, sessionId);
  removeFromWaitlist(waitlistSheet, sessionId);

  SpreadsheetApp.getUi().alert('Attendee assigned to ' + selectedSpace + ' with game ' + selectedGame + '.');
}


function getWaitlistEntries(waitlistSheet) {
  var data = waitlistSheet.getDataRange().getValues();
  var entries = [];

  for (var i = 1; i < data.length; i++) {
    entries.push({
      sessionId: data[i][0],
      uniqueId: data[i][1],
      firstName: data[i][2],
      game: data[i][3],
      phoneNumber: data[i][4],
      checkInTime: data[i][5]
    });
  }
  return entries;
}

function promptSelectFromWaitlist(waitlistEntries) {
  var ui = SpreadsheetApp.getUi();
  var names = waitlistEntries.map(function(entry, index) {
    return (index + 1) + '. ' + entry.firstName + ' - Game: ' + entry.game;
  }).join('\n');

  var response = ui.prompt('Select Attendee', 'Enter the number of the attendee to assign:\n' + names, ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operation cancelled.');
    return null;
  }

  var selectedIndex = parseInt(response.getResponseText()) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= waitlistEntries.length) {
    ui.alert('Invalid selection.');
    return null;
  }

  return waitlistEntries[selectedIndex];
}

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
// Mark as Notified Function
// =========================
function markAsNotified() {
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var waitlistEntries = getWaitlistEntries(waitlistSheet);

  if (waitlistEntries.length === 0) {
    SpreadsheetApp.getUi().alert("No attendees are currently on the waitlist.");
    return;
  }

  // Create HTML form for waitlist selection
  var template = HtmlService.createTemplateFromFile('WaitlistSelection');
  template.waitlistEntries = waitlistEntries;
  template.title = 'Select Attendee to Mark as Notified'; // Ensure this line is present
  template.buttonLabel = 'Mark as Notified';
  template.callbackFunction = 'processMarkAsNotified';

  var htmlOutput = template.evaluate().setWidth(300).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Mark Attendee as Notified');
}

function getWaitlistEntries(waitlistSheet) {
  var data = waitlistSheet.getDataRange().getValues();
  var entries = [];

  for (var i = 1; i < data.length; i++) {
    entries.push({
      sessionId: data[i][0],   // Column A: SessionID
      firstName: data[i][1],   // Column B: FName
      phoneNumber: data[i][2], // Column C: Phone Number
      game: data[i][3],        // Column D: Game
      wlTime: data[i][4],      // Column E: WL Time
      rowIndex: i + 1
    });
  }
  return entries;
}

function processMarkAsNotified(selectedSessionId) {
  var ui = SpreadsheetApp.getUi();
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var data = waitlistSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === selectedSessionId) { // Column A: SessionID
      waitlistSheet.getRange(i + 1, 6).setValue(new Date()); // Column F: Time Notified
      ui.alert('Attendee has been marked as notified.');
      return;
    }
  }

  ui.alert('Attendee not found on the waitlist.');
}


// =========================
// Mark as No Show Function
// =========================

function markAsNoShow() {
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var data = trackerSheet.getDataRange().getValues();
  var waitingAttendees = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][15] === "Waiting") { // Column P (index 15)
      waitingAttendees.push({
        sessionId: data[i][0],     // Session ID
        firstName: data[i][2],     // First Name
        lastName: data[i][3]       // Last Name
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
}

function processMarkAsNoShow(selectedSessionId) {
  var ui = SpreadsheetApp.getUi();
  var trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tracker');
  var waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waitlist');
  var data = trackerSheet.getDataRange().getValues();
  var rowToUpdate = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === selectedSessionId && data[i][15] === "Waiting") { // Column A and Session Status
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
}
