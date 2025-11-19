require("dotenv").config();
const IORedis = require("ioredis");

/**
 * Production-ready Redis configuration with proper error handling
 * Supports: Local Redis, Docker, and Redis Cloud (Upstash, Redis Labs, etc.)
 */

// Parse Redis URL or use individual config
function getRedisConfig() {
  // If REDIS_URL is provided, ioredis can parse it directly
  // But we'll parse it ourselves for better control and validation
  if (process.env.REDIS_URL) {
    try {
      return parseRedisUrl(process.env.REDIS_URL);
    } catch (error) {
      console.warn("⚠️  Failed to parse REDIS_URL, falling back to individual config");
    }
  }

  // Fallback to individual environment variables
  const config = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  };

  // Only add optional fields if they're defined
  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }
  
  if (process.env.REDIS_DB) {
    config.db = parseInt(process.env.REDIS_DB, 10);
  }
  
  // TLS/SSL support for Redis Cloud
  if (process.env.REDIS_TLS === "true") {
    config.tls = {};
  }

  return config;
}

/**
 * Parse Redis URL string (supports redis:// and rediss://)
 * Examples:
 * - redis://localhost:6379
 * - redis://:password@localhost:6379
 * - rediss://:password@host:port (TLS)
 */
function parseRedisUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  } catch (error) {
    console.warn("⚠️  Failed to parse REDIS_URL, using defaults:", error.message);
    return {
      host: "localhost",
      port: 6379,
    };
  }
}

/**
 * Custom retry strategy with exponential backoff
 * Prevents MaxRetriesPerRequestError by limiting retries appropriately
 */
function retryStrategy(times) {
  const delay = Math.min(times * 50, 2000); // Max 2 seconds delay
  
  // Stop retrying after 10 attempts (prevents infinite loops)
  if (times > 10) {
    console.error("❌ Redis: Max retry attempts reached. Stopping retries.");
    return null; // Return null to stop retrying
  }
  
  console.warn(`⚠️  Redis: Retry attempt ${times} in ${delay}ms...`);
  return delay;
}

// Create Redis configuration
const redisConfig = {
  ...getRedisConfig(),
  
  // Retry configuration
  retryStrategy,
  // Set to null to allow connection retries, but commands will fail fast
  // This prevents MaxRetriesPerRequestError during connection failures
  maxRetriesPerRequest: null,
  
  // Connection options
  connectTimeout: 10000, // 10 seconds
  lazyConnect: true, // Don't connect immediately - we'll connect manually after setup
  
  // Reconnection options
  reconnectOnError: (err) => {
    // Reconnect on connection errors, but not on command errors
    const reconnectableErrors = ["READONLY", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"];
    return reconnectableErrors.some(errorType => err.message.includes(errorType));
  },
  
  // Keep-alive
  keepAlive: 30000, // 30 seconds
  
  // Disable offline queue to prevent command retries when disconnected
  // Commands will fail immediately if not connected (prevents MaxRetriesPerRequestError)
  enableOfflineQueue: false,
  
  // Command timeout
  commandTimeout: 5000, // 5 seconds
  
  // Auto reconnect on connection loss
  enableReadyCheck: true,
};

/**
 * Create Redis client with comprehensive error handling
 */
function createRedisClient(config, clientName = "Redis") {
  const client = new IORedis(config);

  // Connection event handlers
  client.on("connect", () => {
    console.log(`✅ ${clientName}: Connected successfully`);
  });

  client.on("ready", () => {
    console.log(`✅ ${clientName}: Ready to accept commands`);
  });

  client.on("error", (error) => {
    // Log error but don't crash the application
    // This handler catches connection-level errors
    console.error(`❌ ${clientName}: Connection error:`, error.message);
    
    // Handle specific error types
    if (error.message.includes("ECONNREFUSED")) {
      console.error(`❌ ${clientName}: Connection refused. Is Redis running?`);
    } else if (error.message.includes("ETIMEDOUT")) {
      console.error(`❌ ${clientName}: Connection timeout. Check network/firewall.`);
    } else if (error.message.includes("ENOTFOUND")) {
      console.error(`❌ ${clientName}: DNS resolution failed. Check hostname: ${config.host}`);
      console.error(`❌ ${clientName}: Server will continue without Redis adapter`);
    } else if (error.message.includes("NOAUTH")) {
      console.error(`❌ ${clientName}: Authentication failed. Check password.`);
    } else if (error.message.includes("MaxRetriesPerRequestError")) {
      console.error(`❌ ${clientName}: Max retries reached. Redis may be unavailable.`);
      console.error(`❌ ${clientName}: This usually means Redis is unreachable. Server will continue without Redis adapter.`);
    }
    
    // Don't throw - let the application continue without Redis
    // The retry strategy will handle reconnection attempts
  });

  client.on("close", () => {
    console.warn(`⚠️  ${clientName}: Connection closed`);
  });

  client.on("reconnecting", (delay) => {
    console.warn(`⚠️  ${clientName}: Reconnecting in ${delay}ms...`);
  });

  client.on("end", () => {
    console.warn(`⚠️  ${clientName}: Connection ended`);
  });

  // Handle unhandled promise rejections from Redis commands
  client.on("nodeError", (error, node) => {
    console.error(`❌ ${clientName}: Node error on ${node.options.host}:${node.options.port}:`, error.message);
  });

  return client;
}

// Create pub/sub clients for Socket.IO adapter
let pubClient = null;
let subClient = null;

try {
  pubClient = createRedisClient(redisConfig, "Redis Pub");
  
  // Use duplicate() for Socket.IO adapter (recommended - shares connection pool)
  // The duplicate will inherit maxRetriesPerRequest: null from the parent
  subClient = pubClient.duplicate();
  
  // Add comprehensive error handlers to subClient
  subClient.on("connect", () => {
    console.log("✅ Redis Sub: Connected successfully");
  });

  subClient.on("ready", () => {
    console.log("✅ Redis Sub: Ready to accept commands");
  });

  subClient.on("error", (error) => {
    console.error("❌ Redis Sub: Connection error:", error.message);
    if (error.message.includes("ENOTFOUND")) {
      console.error("❌ Redis Sub: DNS resolution failed. Server will continue without Redis adapter");
    } else if (error.message.includes("ECONNREFUSED")) {
      console.error("❌ Redis Sub: Connection refused. Is Redis running?");
    } else if (error.message.includes("ETIMEDOUT")) {
      console.error("❌ Redis Sub: Connection timeout. Check network/firewall.");
    } else if (error.message.includes("MaxRetriesPerRequestError")) {
      console.error("❌ Redis Sub: Max retries reached. Redis may be unavailable.");
      console.error("❌ Redis Sub: Server will continue without Redis adapter.");
      // Prevent the error from crashing the app
      return;
    }
  });

  subClient.on("close", () => {
    console.warn("⚠️  Redis Sub: Connection closed");
  });

  subClient.on("reconnecting", (delay) => {
    console.warn(`⚠️  Redis Sub: Reconnecting in ${delay}ms...`);
  });

  subClient.on("end", () => {
    console.warn("⚠️  Redis Sub: Connection ended");
  });

  // Connect clients (lazy connect was enabled, so we connect manually)
  // This allows us to handle connection errors gracefully
  // Don't await - let it connect in the background
  pubClient.connect().catch((error) => {
    // Connection errors are already handled by the 'error' event handler
    // This catch is just to prevent unhandled promise rejections
    if (error.message.includes("ENOTFOUND")) {
      console.error("❌ Redis Pub: DNS resolution failed. Check your REDIS_URL or REDIS_HOST");
      console.warn("⚠️  Redis: Server will continue without Redis adapter");
    }
  });

  subClient.connect().catch((error) => {
    // Connection errors are already handled by the 'error' event handler
    // This catch is just to prevent unhandled promise rejections
  });

  // Test connection only after a successful connection
  // Don't call ping() immediately - wait for 'ready' event
  pubClient.once("ready", () => {
    // Only ping after connection is ready
    pubClient.ping()
      .then((result) => {
        if (result === "PONG") {
          console.log("✅ Redis: Connection test successful");
        }
      })
      .catch((error) => {
        // This should rarely happen if we're already 'ready'
        console.warn("⚠️  Redis: Ping failed after ready state:", error.message);
      });
  });

} catch (error) {
  console.error("❌ Redis: Failed to initialize clients:", error.message);
  console.warn("⚠️  Redis: Server will continue without Redis adapter");
}

/**
 * Check if Redis is available and connected
 */
function isRedisAvailable() {
  return pubClient && subClient && pubClient.status === "ready";
}

/**
 * Gracefully close Redis connections
 */
function closeRedisConnections() {
  return Promise.all([
    pubClient?.quit().catch(() => {}),
    subClient?.quit().catch(() => {}),
  ]).then(() => {
    console.log("✅ Redis: Connections closed gracefully");
  });
}

// Global error handler for unhandled promise rejections from Redis
// This is a safety net to prevent crashes from MaxRetriesPerRequestError
process.on("unhandledRejection", (reason, promise) => {
  if (reason && reason.message && reason.message.includes("MaxRetriesPerRequestError")) {
    console.error("❌ Redis: Caught unhandled MaxRetriesPerRequestError - Redis is unavailable");
    console.warn("⚠️  Redis: Server will continue without Redis adapter");
    // Don't crash - just log and continue
    return;
  }
  // For other unhandled rejections, log but don't crash in production
  // In development, you might want to re-throw these
  if (process.env.NODE_ENV !== "production") {
    console.error("Unhandled Rejection:", reason);
  }
});

// Handle process termination
process.on("SIGTERM", closeRedisConnections);
process.on("SIGINT", closeRedisConnections);

module.exports = {
  pubClient,
  subClient,
  isRedisAvailable,
  closeRedisConnections,
  // Export config for debugging
  redisConfig,
};

