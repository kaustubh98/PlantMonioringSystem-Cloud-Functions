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
  //const snapshot = await (p.once('value'));
  

}));

// exports.truncate = functions.database.ref('{userId}/Average/{paramID}').onCreate((snapshot,context) => {
//     console.log('Triggered Truncate function');
//     // const parameter = context.params.parameter;
//     // const n = snapshot.numChildren();
//     // console.log('Parameter changed is: '+parameter);
//     // console.log('There are '+n+' childern in the snapshot');
//     return null;
// });

//exports.truncate = functions.database.ref('{userId}/Average/{}')
