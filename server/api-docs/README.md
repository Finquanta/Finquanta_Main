# Finquanta AI Server API Documentation

Comprehensive financial management API for tracking income, expenses, and generating financial insights.

**Version:** 1.0.0
**Base URL:** `http://localhost:3001/api/v1`

## 🚀 Quick Start

### 1. Server Setup

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev

# Server will be available at http://localhost:3001
```

### 2. Authentication Flow

1. **Register a new user account**
2. **Login to receive access and refresh tokens**
3. **Include the access token in API requests**
4. **Refresh tokens when they expire**

### 3. Make Your First Request

```bash
# Check API health
curl http://localhost:3001/health

# Register a user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login to get tokens
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!"
  }'
```

## 📚 Documentation

- **[Swagger UI](./index.html)** - Interactive API documentation with "Try it out" functionality
- **[ReDoc](./redoc.html)** - Alternative documentation format with better mobile support
- **[OpenAPI Spec](./openapi.json)** - Raw OpenAPI specification for programmatic use
- **[OpenAPI YAML](./openapi.yaml)** - OpenAPI specification in YAML format

## 🔧 API Collections

Import these collections into your favorite API client:

- **[Postman Collection](./collections/postman_collection.json)** - Import to Postman
- **[Insomnia Workspace](./collections/insomnia_workspace.json)** - Import to Insomnia
- **[Bruno Collection](./collections/bruno_collection.bru)** - Import to Bruno

## 📋 Available Endpoints

### Health Checks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Basic health check | ❌ |
| GET | `/health/detailed` | Detailed health info | ❌ |

### API Information

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api` | Get API information | ❌ |
| GET | `/api/version` | Get API version | ❌ |
| GET | `/api/test` | Test endpoint | ❌ |

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | ❌ |
| POST | `/auth/login` | User login | ❌ |
| POST | `/auth/refresh` | Refresh access token | ❌ |

### Financial Transactions

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/financial/transactions` | Get user transactions | ✅ |
| POST | `/financial/transactions` | Create transaction | ✅ |
| GET | `/financial/transactions/:id` | Get transaction by ID | ✅ |
| PUT | `/financial/transactions/:id` | Update transaction | ✅ |
| DELETE | `/financial/transactions/:id` | Delete transaction | ✅ |

### Financial Analytics

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/financial/summary` | Get financial summary | ✅ |

## 🔐 Authentication

This API uses JWT (JSON Web Token) authentication.

### How to Authenticate

1. **Register or Login** to get tokens
2. **Include the access token** in the `Authorization` header:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

### Token Types

- **Access Token**: Valid for 15 minutes, used for API requests
- **Refresh Token**: Valid for 7 days, used to get new access tokens

### Example Authentication Flow

```javascript
// 1. Register user
const registerResponse = await fetch('http://localhost:3001/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe'
  })
});

const { data } = await registerResponse.json();
const { accessToken, refreshToken } = data;

// 2. Use access token for authenticated requests
const transactionsResponse = await fetch('http://localhost:3001/api/v1/financial/transactions', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// 3. Refresh token when expired
const refreshResponse = await fetch('http://localhost:3001/api/v1/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});
```

## 💼 Common Use Cases

### 1. Track Monthly Expenses

```bash
# Create an expense transaction
curl -X POST http://localhost:3001/api/v1/financial/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "type": "expense",
    "category": "Food & Dining",
    "subcategory": "Restaurants",
    "amount": 45.50,
    "description": "Lunch with team",
    "date": "2024-01-15"
  }'

# Get all expenses for January
curl "http://localhost:3001/api/v1/financial/transactions?type=expense&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. Calculate Monthly Summary

```bash
# Get financial summary for January
curl "http://localhost:3001/api/v1/financial/summary?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Advanced Filtering

```bash
# Get recent income transactions, sorted by amount
curl "http://localhost:3001/api/v1/financial/transactions?type=income&limit=10&sortBy=amount&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get transactions for a specific category
curl "http://localhost:3001/api/v1/financial/transactions?category=Salary&startDate=2024-01-01" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Search by invoice number
curl "http://localhost:3001/api/v1/financial/transactions?invoice=INV-2024-001" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📊 Data Models

### Transaction Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "income",
  "category": "Salary",
  "subcategory": "Monthly Salary",
  "amount": "5000.00",
  "description": "Monthly salary payment",
  "date": "2024-01-15",
  "invoice": "INV-2024-001",
  "status": "completed",
  "metadata": {
    "department": "Engineering",
    "project": "Finquanta AI"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### User Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-15T09:30:00Z"
}
```

### Financial Summary Object

```json
{
  "totalIncome": "8500.00",
  "totalExpenses": "3250.50",
  "netIncome": "5249.50",
  "transactionCount": 45,
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31"
}
```

## 🛠️ SDK Examples

### JavaScript/Node.js

```javascript
// Install axios: npm install axios
const axios = require('axios');

class FinquantaAIClient {
  constructor(baseURL = 'http://localhost:3001/api/v1') {
    this.baseURL = baseURL;
    this.accessToken = null;
  }

  async register(userData) {
    const response = await axios.post(`${this.baseURL}/auth/register`, userData);
    this.setTokens(response.data.data);
    return response.data;
  }

  async login(email, password) {
    const response = await axios.post(`${this.baseURL}/auth/login`, { email, password });
    this.setTokens(response.data.data);
    return response.data;
  }

  setTokens({ accessToken, refreshToken }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  async createTransaction(transactionData) {
    const response = await axios.post(`${this.baseURL}/financial/transactions`, transactionData, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    return response.data;
  }

  async getTransactions(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await axios.get(`${this.baseURL}/financial/transactions?${params}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    return response.data;
  }

  async getFinancialSummary(startDate, endDate) {
    const response = await axios.get(`${this.baseURL}/financial/summary`, {
      params: { startDate, endDate },
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    return response.data;
  }
}

// Usage example
const client = new FinquantaAIClient();

// Register and login
await client.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe'
});

// Create a transaction
await client.createTransaction({
  type: 'income',
  category: 'Salary',
  amount: 5000,
  date: '2024-01-15'
});

// Get transactions
const transactions = await client.getTransactions({ limit: 10 });
console.log(transactions);
```

### Python

```python
# Install requests: pip install requests
import requests

class FinquantaAIClient:
    def __init__(self, base_url="http://localhost:3001/api/v1"):
        self.base_url = base_url
        self.access_token = None
        self.refresh_token = None

    def register(self, user_data):
        response = requests.post(f"{self.base_url}/auth/register", json=user_data)
        self.set_tokens(response.json()['data'])
        return response.json()

    def login(self, email, password):
        response = requests.post(f"{self.base_url}/auth/login", json={
            'email': email, 'password': password
        })
        self.set_tokens(response.json()['data'])
        return response.json()

    def set_tokens(self, tokens):
        self.access_token = tokens['accessToken']
        self.refresh_token = tokens['refreshToken']

    def create_transaction(self, transaction_data):
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.post(
            f"{self.base_url}/financial/transactions",
            json=transaction_data,
            headers=headers
        )
        return response.json()

    def get_transactions(self, **filters):
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.get(
            f"{self.base_url}/financial/transactions",
            params=filters,
            headers=headers
        )
        return response.json()

    def get_financial_summary(self, start_date, end_date):
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.get(
            f"{self.base_url}/financial/summary",
            params={'startDate': start_date, 'endDate': end_date},
            headers=headers
        )
        return response.json()

# Usage example
client = FinquantaAIClient()

# Register and login
client.register({
    'email': 'user@example.com',
    'password': 'SecurePass123!',
    'firstName': 'John',
    'lastName': 'Doe'
})

# Create a transaction
client.create_transaction({
    'type': 'income',
    'category': 'Salary',
    'amount': 5000,
    'date': '2024-01-15'
})

# Get transactions
transactions = client.get_transactions(limit=10)
print(transactions)
```

## 🔍 Query Parameters

### Transactions Endpoint

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `type` | string | Filter by transaction type | `income`, `expense` |
| `category` | string | Filter by category | `Salary`, `Food & Dining` |
| `subcategory` | string | Filter by subcategory | `Monthly Salary` |
| `startDate` | string | Filter by start date (YYYY-MM-DD) | `2024-01-01` |
| `endDate` | string | Filter by end date (YYYY-MM-DD) | `2024-01-31` |
| `status` | string | Filter by status | `pending`, `completed`, `failed` |
| `invoice` | string | Filter by invoice number | `INV-2024-001` |
| `limit` | integer | Number of results to return (1-1000) | `20` |
| `offset` | integer | Number of results to skip | `0` |
| `sortBy` | string | Sort field | `date`, `amount`, `category`, `createdAt` |
| `sortOrder` | string | Sort order | `asc`, `desc` |

### Financial Summary Endpoint

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `startDate` | string | Yes | Summary period start date | `2024-01-01` |
| `endDate` | string | Yes | Summary period end date | `2024-01-31` |

## 🚨 Error Handling

The API returns standard HTTP status codes and consistent error responses:

### Error Response Format

```json
{
  "success": false,
  "error": "Error description",
  "message": "Additional context",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing token |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

## 🔒 Security Considerations

- **HTTPS**: Use HTTPS in production environments
- **Token Storage**: Store tokens securely on the client side
- **Password Security**: Use strong passwords (8+ chars, mixed case, numbers, special chars)
- **Rate Limiting**: The API implements rate limiting to prevent abuse
- **Input Validation**: All inputs are validated on the server side

## 🌍 Environments

| Environment | Base URL | Description |
|-------------|----------|-------------|
| Development | `http://localhost:3001/api/v1` | Local development server |
| Staging | `https://staging-api.Finquantaai.com/v1` | Staging environment |
| Production | `https://api.Finquantaai.com/v1` | Production environment |

## 📞 Support

For support, please contact:
- **Email**: support@Finquantaai.com
- **Documentation**: https://docs.Finquantaai.com
- **Issues**: https://github.com/Finquantaai/server/issues

## 📄 License

This API is licensed under the MIT License. See [LICENSE](../LICENSE) for details.

---

**Generated with ❤️ using the Finquanta AI Documentation Generator**
*Last updated: January 15, 2024*