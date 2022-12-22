This repository contains the code for the experiments described in [Afrouzi, Kwon, Landier, Ma and Thesmar (2022)](https://afrouzi.com/aklmt_overreaction.pdf).

## Preview
You can preview the experiments by accessing the link below. This will allow you to view demonstrations of all the treatments.

Please note that this is just for previewing purposes and is not an actual experiment. Your responses will not be saved, and while you may see scores and bonuses that a participant with your responses would have received, you are not participating in any experiments and will not receive any payments.  

Please also note that the dimensions of the preview window may differ from what actual participants saw. To replicate the dimensions exactly, please use the "Deployment" procedure below and launch the experiments on Amazon MTurk Sandbox. However, please note that conducting experiments on MTurk to collect data might require IRB approval from your institution and we are not responsible for any such requirements on your end.

Link to demonstrations: [https://forecast-research.herokuapp.com/](https://forecast-research.herokuapp.com/)

## Deployment

To launch the interface, you will need to set up the following accounts:

1. A Heroku account (which may require a paid subscription).

2. An Amazon AWS account that is linked to your Amazon mTurk account. To do this, proceed according to the steps in the following guide: [https://docs.aws.amazon.com/AWSMechTurk/latest/AWSMechanicalTurkGettingStartedGuide/SetUp.html](https://docs.aws.amazon.com/AWSMechTurk/latest/AWSMechanicalTurkGettingStartedGuide/SetUp.html). 

Make sure to select AmazonMechanicalTurkFullAccess in step 4, and to link your AWS account to both the mTurk requester and mTurk requester sandbox accounts as described in the guide.

Once these accounts are setup, follow these next steps to deploy the interface to Heroku:

1. Press the button below to begin. If you don't have a Heroku account you will be able to create one first.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/forecast-research/interface)

2. Enter a name for your app. This will also be the url to the interface in the form of appName.herokuapp.com.

3. Enter your mTurk credentials (Id + secret). Save this for later.

4. Choose an admin password for the interface. Note that the default username is 'admin'.

5. Press "Deploy app".

After a few minutes our app along with a database instance should be created. We now just need to create a database and user in the instance and restart the app. Click "Manage App".

1. In the app dashboard, click on the database add-on "ObjectRocket for MongoDB". This should open up another dashboard for managing the database.

2. Open the databases tab and press "Add database".

3. For the database name and username use "interface". For password, use your AWS secret again. Press "add database".

We now have our user + database and need to restart the app.

1. Switch back to the Heroku app dashboard.

2. Press "more" followed by "Restart all dynos".

After a few minutes the app should be up and running at appName.herokuapp.com/admin.

## Deleting the app from Heroku

> ❗️ WARNING, this will delete the database, all experiment data will be lost.

1. To delete the app, open the settings tab in the Heroku app dashboard.

2. Click the red Delete app button at the bottom.
