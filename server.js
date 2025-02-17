require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { ApolloServer, gql } = require('apollo-server-express');

// Import Models (we'll use these in resolvers later)
const User = require('./models/User');
const Employee = require('./models/Employee');
const bcrypt = require('bcryptjs'); // for password hashing
const jwt = require('jsonwebtoken');  // for token creation (optional)

const app = express();

// Define GraphQL type definitions
const typeDefs = gql`
  type User {
    username: String!
    email: String!
    created_at: String
    updated_at: String
  }
  
  type Employee {
    _id: ID
    first_name: String!
    last_name: String!
    email: String
    gender: String
    designation: String!
    salary: Float!
    date_of_joining: String!
    department: String!
    employee_photo: String
    created_at: String
    updated_at: String
  }
  
  type Query {
    login(username: String, email: String, password: String!): User
    getAllEmployees: [Employee]
    searchEmployeeByEid(eid: ID!): Employee
    searchEmployeeByDesignationOrDepartment(designation: String, department: String): [Employee]
  }
  
  type Mutation {
    signup(username: String!, email: String!, password: String!): User
    addNewEmployee(
      first_name: String!,
      last_name: String!,
      email: String,
      gender: String,
      designation: String!,
      salary: Float!,
      date_of_joining: String!,
      department: String!,
      employee_photo: String
    ): Employee
    updateEmployeeByEid(
      eid: ID!,
      first_name: String,
      last_name: String,
      email: String,
      gender: String,
      designation: String,
      salary: Float,
      date_of_joining: String,
      department: String,
      employee_photo: String
    ): Employee
    deleteEmployeeByEid(eid: ID!): String
  }
`;

// Define resolvers (logic for each GraphQL operation)
const resolvers = {
  Query: {
    login: async (_, { username, email, password }) => {
      // Example login logic using username or email
      const user = await User.findOne({ $or: [{ username }, { email }] });
      if (!user) throw new Error('User not found');
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new Error('Invalid credentials');
      // Optionally generate a JWT token here if required
      return user;
    },
    getAllEmployees: async () => {
      return await Employee.find();
    },
    searchEmployeeByEid: async (_, { eid }) => {
      return await Employee.findById(eid);
    },
    searchEmployeeByDesignationOrDepartment: async (_, { designation, department }) => {
      const query = [];
      if (designation) query.push({ designation });
      if (department) query.push({ department });
      return await Employee.find({ $or: query });
    }
  },
  Mutation: {
    signup: async (_, { username, email, password }) => {
      // Check if user already exists
      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) throw new Error('User already exists');
      
      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = new User({ username, email, password: hashedPassword });
      return await newUser.save();
    },
    addNewEmployee: async (_, args) => {
      const newEmployee = new Employee(args);
      return await newEmployee.save();
    },
    updateEmployeeByEid: async (_, { eid, ...updateFields }) => {
      const updatedEmployee = await Employee.findByIdAndUpdate(eid, updateFields, { new: true });
      if (!updatedEmployee) throw new Error('Employee not found');
      return updatedEmployee;
    },
    deleteEmployeeByEid: async (_, { eid }) => {
      await Employee.findByIdAndDelete(eid);
      return "Employee deleted successfully";
    }
  }
};

async function startServer() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app });
  
  // Connect to MongoDB Atlas using the URI from .env
  const mongoUri = process.env.MONGODB_URI;
  mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
}

startServer();
