# Redis Configuration Guide

## Overview

The Redis configuration in `redis.js` is production-ready and handles errors gracefully. The server will continue to run even if Redis is unavailable, though Socket.IO horizontal scaling won't work without it.

## Environment Variables

### Option 1: Redis URL (Recommended)
```env
REDIS_URL=redis://localhost:6379
# Or with password:
REDIS_URL=redis://:password@localhost:6379
# Or with TLS (Redis Cloud):
REDIS_URL=rediss://:password@host:port
```

### Option 2: Individual Configuration
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password  # Optional
REDIS_DB=0                    # Optional, defaults to 0
REDIS_TLS=true                # Optional, for TLS/SSL connections
```

## Configuration Scenarios

### Local Redis (Development)
```env
REDIS_URL=redis://localhost:6379
```

### Docker Redis
```env
REDIS_URL=redis://redis:6379
# Or if using docker-compose service name
REDIS_HOST=redis
REDIS_PORT=6379
```

### Redis Cloud (Upstash, Redis Labs, etc.)
```env
# Upstash example
REDIS_URL=rediss://default:password@host.upstash.io:6379

# Or with individual config
REDIS_HOST=host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_TLS=true
```

## Error Handling

The Redis client includes comprehensive error handling:

1. **Connection Errors**: Logged but don't crash the application
2. **Retry Strategy**: Exponential backoff with max 10 attempts
3. **Max Retries**: Limited to 3 per request to prevent `MaxRetriesPerRequestError`
4. **Graceful Degradation**: Server continues without Redis adapter

## Features

- ✅ Automatic reconnection with exponential backoff
- ✅ Connection state monitoring
- ✅ Graceful shutdown on process termination
- ✅ Support for TLS/SSL connections
- ✅ URL and individual config support
- ✅ Comprehensive error logging
- ✅ Prevents application crashes

## Troubleshooting

### "MaxRetriesPerRequestError"
This error occurs when Redis is unreachable. The new configuration:
- Limits retries to prevent this error
- Logs clear error messages
- Allows the server to continue running

### "ECONNREFUSED"
Redis server is not running or not accessible at the specified host/port.

### "NOAUTH"
Authentication failed. Check your `REDIS_PASSWORD` or password in `REDIS_URL`.

### "ETIMEDOUT"
Connection timeout. Check:
- Network connectivity
- Firewall rules
- Redis server status

