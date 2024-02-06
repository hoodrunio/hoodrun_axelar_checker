print('Starting init-mongo.js...');

print('Creating new user...');

try {
  const { DB_USER, DB_PWD, DB_NAME, MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD } = process.env;

  db = db.getSiblingDB('admin');

  db.auth(MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD);

  db = db.getSiblingDB(DB_NAME);

  db.createUser({
    user: DB_USER,
    pwd: DB_PWD,
    roles: [
      {
        role: 'dbOwner',
        db: DB_NAME,
      },
    ],
  });

  print('User creation completed.');
} catch (err) {
  print('Error creating user: ' + err);
}

print('Ending init-mongo.js...');
