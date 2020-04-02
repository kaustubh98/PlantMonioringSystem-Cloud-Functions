// //to create cloud functions and setup triggers
const functions = require('firebase-functions');
const MAX_LOG_COUNT = 5;
// //to access database
const admin = require('firebase-admin');
admin.initializeApp();

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

// exports.helloWorld = functions.https.onRequest((request, response) => {
//     console.log('Deployed Function Successfully');
//     response.send("Hello World.. My Functions is up and working.");
// });

exports.truncate = functions.database.ref('/{userid}/Average/{paramID}').onWrite((change => {
  console.log('Truncate Triggered Successfully');
   const p = change.after.ref;
   console.log('DataSnapshot has: '+p.toJSON());
   p.once('value')
   .then(function(snapshot) {
    console.log('Data object has '+snapshot.numChildren()+' Childrens');
    if (snapshot.numChildren() >= MAX_LOG_COUNT) {
        let childCount = 0;
        const updates = {};
        snapshot.forEach((child) => {
          if (++childCount <= snapshot.numChildren() - MAX_LOG_COUNT) {
            updates[child.key] = null;
          }
        });
        // Update the parent. This effectively removes the extra children.
        return p.update(updates);
      }
    return null;
   })
   .catch(err => {
       console.log('Error Occured',err);
   });
}));

// exports.appendTime = functions.database.ref('{userID}/Zones/{zone}/{paramID}/{value}').onCreate( async (snapshot,context) => {
//   var addedValue = snapshot.val() + '_' + Date.now();
//   const userID = context.params.userID;
//   const paramter = context.params.paramID;
//   const zone = context.params.zone;
//   console.log('Triggerd appendTime');
//   console.log('new value: '+addedValue);
//   const key = snapshot.ref.key;
//   console.log('Key is '+key);
//   return snapshot.ref.parent.update({key:addedValue});
// });

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
          oldValue = child.val(); // last value
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

      // if average is calculated for first time, add value directly
       const dbRef = admin.database().ref(userID+'/Average/'+paramter);
      if(oldAvg === 0){
        newAvg = addedValue;
      }else{
        // calculate new average
        if(oldValue === 0){
          //new Sensor unit added
          newAvg = ((oldAvg*(num-1)) - oldValue + addedValue)/num;
        }else{
          //just new Reading
          newAvg = ((oldAvg*(num)) - oldValue + addedValue)/num;
        }
      }

      newAvg = newAvg + '_' + Date.now();

    }catch(err){
      console.log('Error: ',err);
    }
    return admin.database().ref(userID+'/Average/'+paramter).push(newAvg);
  });