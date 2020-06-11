// //to create cloud functions and setup triggers
const functions = require('firebase-functions');
const MAX_LOG_COUNT = 10;
// //to access database
const admin = require('firebase-admin');
admin.initializeApp();

 // add timestamp to readings obtained from sensors
exports.appendTime = functions.database.ref('{userID}/Zones/{zone}/{paramID}/{value}').onCreate( async (snapshot,context) => {
  var addedValue = snapshot.val() + '_' + Date.now();
  const userID = context.params.userID;
  const paramter = context.params.paramID;
  const zone = context.params.zone;
  console.log('Triggerd appendTime');
  console.log('new value: '+addedValue);
  const key = snapshot.ref.key;
  console.log('Key is '+key);
  
  return snapshot.ref.set(addedValue);
});

//calculate the average of the sensor value readings of various units
exports.calculateAverage = functions.database.ref('{userID}/Zones/{zone}/{paramID}/{value}').onCreate( async (snapshot,context) => {
    console.log('Triggered function calculateAverage');
    console.log('Snapshot: '+snapshot.val());
    const userID = context.params.userID; //user id
    const paramter = context.params.paramID;
    const addedValue = snapshot.val(); // latest value received
    var oldValue = 0;
    var newAvg = 0;
    var oldAvg = 0;

    try{
      const valSnap = await snapshot.ref.parent.once('value');
      const index = valSnap.numChildren() - 2;
      var count = 0;
      valSnap.forEach(function(child){
        if(count === index){
          oldValue = child.val().split("_")[0]; // last value
        }
        count++;
      });
      console.log('Old Value: '+oldValue+' Count: '+count);

      //get the number of value
      const numSnap = await admin.database().ref(userID+'/NumberOfUnits').once('value');
      const num = numSnap.val();
      console.log('Number Of Devices: '+num);

      const oldAvgSnap = await admin.database().ref(userID+'/Average/'+paramter).once('value');
      if(oldAvgSnap.hasChildren()){
        var lastChild;
        oldAvgSnap.forEach( function(child) {
          lastChild = child;
        });      
        oldAvg = lastChild.val(); // last Average Value with timestamp
        oldAvg = oldAvg.split("_")[0];
        console.log('Truncated OldAverage: '+oldAvg);
      }
      
      console.log('Old Average: '+oldAvg);

      const dbRef = admin.database().ref(userID+'/Average/'+paramter);
       // calculate new average
       if(oldValue === 0){
        //new Sensor unit added
        newAvg = ((oldAvg*(num-1)) - oldValue + addedValue)/num;
      }else{
        //just new Reading
        newAvg = ((oldAvg*(num)) - oldValue + addedValue)/num;
      }

      newAvg = newAvg + '_' + Date.now();

    }catch(err){
      console.log('Error: ',err);
    }
    return admin.database().ref(userID+'/Average/'+paramter).push(newAvg);
  });

//send notification to user if any parameter is beyond acceptable limits
exports.notifyUser = functions.database.ref('/{userid}/Average/{paramID}/{value}').onCreate(async (snapshot,context) => {
  var value = snapshot.val().split("_")[0];
  var user = context.params.userid;
  console.log('UserId: '+user);
  var token = await (await admin.database().ref(user+'/MessageToken').once('value')).val();
  console.log('User Token: '+token);
  var parameter = context.params.paramID;
  console.log('Parameter: '+parameter);

  const displayMessage = parameter + ": " + value;

  const payload = {
    notification: {
      title: parameter + " has recorded an unacceptable value",
      body: displayMessage,
      sound: "default"
    }
  };

  try {

    if(parseInt(value,10) < 40 && parameter.localeCompare("Moisture") === 0){
      const response = await admin.messaging().sendToDevice(token, payload);
      console.log("Successfully sent message:", response);  
    } 

    console.log('value: '+parseInt(value,10) < 40);
    console.log('parameter check: '+(parameter.localeCompare("Moisture") === 0))
    
    return null;
  }
  catch (error) {
    console.log("Error sending message:", error);
  }

});

//notify the user when battery level drops below the required threshold
exports.batteryLevelIndication = functions.database.ref('{userID}/Zones/{zone}/BatteryLevel').onUpdate(async (snapshot,context) => {
  console.log('Level Indicator Triggered');
  
  var level = snapshot.after.val();
  console.log('Value: '+level);

  var user = context.params.userID;
  var zoneID = context.params.zone;
  console.log('User: '+user);
  console.log('ZoneID: '+zoneID);

  var token = await (await admin.database().ref(user+'/MessageToken').once('value')).val();
  var des = await (await admin.database().ref(user + '/Zones/' + zoneID + '/Description').once('value')).val();
  console.log('Description: '+des);
  const displayMessage = "Sensor unit with ID "+ zoneID +" and location described as "+ des + " has reported a low battery level. Kindly change the battery to avoid any disfunctioning";
  const payload = {
    notification: {
      title: "Low Battery Level",
      body: displayMessage,
      sound: "default"
    }
  };



  if(level === 0){
    const response = await admin.messaging().sendToDevice(token, payload);
    console.log("Successfully sent message:", response);  
  }

  return null;

});