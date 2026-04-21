try {
    const express = require('express');
    const mongoose = require('mongoose');
    // Mock mongoose connect if needed, but we just want to see if require works
    console.log("Attempting to require ./routes/members...");
    const memberRoutes = require('./routes/members');
    console.log("✅ Successfully required ./routes/members");
} catch (err) {
    console.error("❌ Failed to require ./routes/members");
    console.error(err);
}
