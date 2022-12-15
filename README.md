
## Deployment

Follow these steps to deploy the interface to Heroku

1. Press the button below to begin. If you don't have a Heroku account you will be able to create one first.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/forecast-research/interface)

2. Enter a name for your app. This will also be the url to the interface in the form of appName.herokuapp.com.

3. Enter your mTurk credentials (Id + secret). Save this for later.

4. Choose an admin password for the interface.

5. Press "Deploy app".

After a few minutes our app along with a database instance should be created. We now just need to create a database and user in the instance and restart the app. Click "Manage App".

1. In the app dashboard, click on the database add-on "ObjectRocket for MongoDB". This should open up another dashboard for managing the database.

2. Open the databases tab and press "Add database".

3. For the database name and username use "interface". For password, use your AWS secret again. Press "add database".

We now have our user + database and need to restart the app.

1. Switch back to the Heroku app dashboard.

2. Press "more" followed by "Restart all dynos".

After a few minutes the app should be up and running at appName.herokuapp.com/admin.

Good luck!

## Deleting the app from Heroku

> ❗️ WARNING, this will delete the database, all experiment data will be lost.

1. To delete the app, open the settings tab in the Heroku app dashboard.

2. Click the red Delete app button at the bottom.