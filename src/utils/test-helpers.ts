import mongoose from 'mongoose';

export const connectTestDb = async () => {
  const isRealDb = process.env.REAL_DB === 'true';
  
  if (isRealDb) {
    const testDbUrl = `mongodb://admin_user:admin_password@localhost:27017/test_db?authSource=admin`;
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(testDbUrl);
        console.log('Real test database connected');
      }
    } catch (error) {
      console.error('Database connection error:', error);
      console.error('Connection URL:', testDbUrl);
      throw error;
    }
  } else {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    try {
      await mongoose.connect(mongoUri);
      console.log('Memory test database connected');
    } catch (error) {
      console.error('Memory database connection error:', error);
      throw error;
    }
  }
};

export const disconnectTestDb = async () => {
  try {
    await mongoose.disconnect();
    console.log('Database disconnected successfully');
  } catch (error) {
    console.error('Error during database disconnect:', error);
    throw error;
  }
};

export async function cleanupCollections() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
      console.log(`Collection ${collection.collectionName} cleaned`);
    }
  }
} 