require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { ApolloServer, gql, UserInputError } = require('apollo-server-express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import Models (make sure these paths match your project structure)
const User = require('./models/User');
const Employee = require('./models/Employee');

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

// Define resolvers with validations and error handling
const resolvers = {
  Query: {
    login: async (_, { username, email, password }) => {
      // Ensure that either username or email is provided along with password
      if ((!username && !email) || !password) {
        throw new UserInputError("Username or email and password are required", {
          invalidArgs: ["username/email", "password"]
        });
      }
      // Find user by username or email
      const user = await User.findOne({ $or: [{ username }, { email }] });
      if (!user) throw new UserInputError("User not found");
      // Compare password hashes
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new UserInputError("Invalid credentials");
      return user;
    },
    getAllEmployees: async () => {
      return await Employee.find();
    },
    searchEmployeeByEid: async (_, { eid }) => {
      if (!eid) {
        throw new UserInputError("Employee ID is required", {
          invalidArgs: ["eid"]
        });
      }
      return await Employee.findById(eid);
    },
    searchEmployeeByDesignationOrDepartment: async (_, { designation, department }) => {
      if (!designation && !department) {
        throw new UserInputError("At least one of designation or department is required", {
          invalidArgs: ["designation", "department"]
        });
      }
      const query = [];
      if (designation) query.push({ designation });
      if (department) query.push({ department });
      return await Employee.find({ $or: query });
    }
  },
  Mutation: {
    signup: async (_, { username, email, password }) => {
      // Validate username
      if (!username || username.trim() === "") {
        throw new UserInputError("Username is required", {
          invalidArgs: ["username"]
        });
      }
      // Validate email presence and format
      if (!email || email.trim() === "") {
        throw new UserInputError("Email is required", {
          invalidArgs: ["email"]
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new UserInputError("Invalid email format", {
          invalidArgs: ["email"]
        });
      }
      // Validate password length
      if (!password || password.length < 6) {
        throw new UserInputError("Password must be at least 6 characters long", {
          invalidArgs: ["password"]
        });
      }
      
      // Check if user already exists
      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        throw new UserInputError("User already exists", {
          invalidArgs: ["username", "email"]
        });
      }
      // Hash the password and create user
      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = new User({ username, email, password: hashedPassword });
      return await newUser.save();
    },
    addNewEmployee: async (_, args) => {
      const { first_name, last_name, designation, salary, date_of_joining, department } = args;
      // Validate required fields for employee creation
      if (!first_name || first_name.trim() === "") {
        throw new UserInputError("First name is required", { invalidArgs: ["first_name"] });
      }
      if (!last_name || last_name.trim() === "") {
        throw new UserInputError("Last name is required", { invalidArgs: ["last_name"] });
      }
      if (!designation || designation.trim() === "") {
        throw new UserInputError("Designation is required", { invalidArgs: ["designation"] });
      }
      if (salary === undefined || salary < 1000) {
        throw new UserInputError("Salary must be at least 1000", { invalidArgs: ["salary"] });
      }
      if (!date_of_joining) {
        throw new UserInputError("Date of joining is required", { invalidArgs: ["date_of_joining"] });
      }
      if (!department || department.trim() === "") {
        throw new UserInputError("Department is required", { invalidArgs: ["department"] });
      }
      const newEmployee = new Employee(args);
      return await newEmployee.save();
    },
    updateEmployeeByEid: async (_, { eid, ...updateFields }) => {
      if (!eid) {
        throw new UserInputError("Employee ID is required", { invalidArgs: ["eid"] });
      }
      const updatedEmployee = await Employee.findByIdAndUpdate(eid, updateFields, { new: true });
      if (!updatedEmployee) {
        throw new UserInputError("Employee not found", { invalidArgs: ["eid"] });
      }
      return updatedEmployee;
    },
    deleteEmployeeByEid: async (_, { eid }) => {
      if (!eid) {
        throw new UserInputError("Employee ID is required", { invalidArgs: ["eid"] });
      }
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
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));
  
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
}

startServer();
