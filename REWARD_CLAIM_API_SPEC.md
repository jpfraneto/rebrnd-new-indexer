# Reward Claim Submission API Specification

## Endpoint

**POST** `https://poiesis.anky.app/blockchain-service/submit-reward-claim`

## Description

This endpoint receives reward claim data from the Ponder indexer when a user claims a reward for a cast. The data is associated with the user's FID, cast hash, and caller information.

## Authentication

- **Type**: Bearer Token
- **Header**: `Authorization: Bearer <INDEXER_API_KEY>`
- **Required**: Yes

## Headers

```
Content-Type: application/json
Authorization: Bearer <INDEXER_API_KEY>
X-Indexer-Source: ponder-stories-in-motion-v5
```

## Request Body Schema

```typescript
{
  id: string; // Unique claim ID: `${transactionHash}-${logIndex}`
  recipient: string; // Wallet address of the reward recipient (lowercase)
  fid: number; // Farcaster ID of the user claiming the reward
  amount: string; // Reward amount as a string (bigint converted to string)
  day: string; // Day number as a string (bigint converted to string)
  castHash: string; // Hash of the cast associated with the reward claim
  caller: string; // Wallet address of the caller (lowercase)
  blockNumber: string; // Block number where the claim occurred (bigint converted to string)
  transactionHash: string; // Hash of the transaction
  timestamp: string; // Block timestamp as a string (bigint converted to string)
}
```

## Request Body Example

```json
{
  "id": "0x2834b087799bf5053f957814292d6dcc7e01f47eb916823704f3a7e1e883eebf-1681",
  "recipient": "0xf2fe4dd9a86ecafe22424bfb6085036bca7835a8",
  "fid": 16098,
  "amount": "100000000000000000000",
  "day": "20399",
  "castHash": "0xabc123...",
  "caller": "0xf2fe4dd9a86ecafe22424bfb6085036bca7835a8",
  "blockNumber": "37868875",
  "transactionHash": "0x2834b087799bf5053f957814292d6dcc7e01f47eb916823704f3a7e1e883eebf",
  "timestamp": "1762527097"
}
```

## Field Descriptions

| Field             | Type   | Description                                                                           | Required |
| ----------------- | ------ | ------------------------------------------------------------------------------------- | -------- |
| `id`              | string | Unique identifier for the reward claim. Format: `${transactionHash}-${logIndex}`      | Yes      |
| `recipient`       | string | Ethereum wallet address of the user receiving the reward (lowercase hex)              | Yes      |
| `fid`             | number | Farcaster ID of the user claiming the reward                                          | Yes      |
| `amount`          | string | Amount of reward tokens claimed (as string to handle large numbers)                   | Yes      |
| `day`             | string | Day number when the reward was claimed (as string to handle large numbers)            | Yes      |
| `castHash`        | string | Hash/identifier of the cast that triggered the reward                                 | Yes      |
| `caller`          | string | Ethereum wallet address of the account that called the claim function (lowercase hex) | Yes      |
| `blockNumber`     | string | Block number where the claim transaction was included (as string)                     | Yes      |
| `transactionHash` | string | Hash of the transaction that contains the claim event                                 | Yes      |
| `timestamp`       | string | Unix timestamp of the block (as string)                                               | Yes      |

## Response

### Success Response

- **Status Code**: `200 OK` (or `2xx` success status)
- **Body**: Implementation dependent (backend should return success confirmation)

### Error Response

- **Status Code**: `4xx` or `5xx` error codes
- **Body**: Error details (implementation dependent)

## Error Handling

The indexer will:

- Log errors if the API key is not set
- Log errors if the request fails (non-2xx status)
- Log errors if there's a network/exception error
- Continue processing other events even if this call fails

## Source Identification

All requests include the header `X-Indexer-Source: ponder-stories-in-motion-v5` to identify the source of the data.

## Related Events

This endpoint is called when the `StoriesInMotionV5:RewardClaimed` event is detected on the blockchain.

## Event Arguments (from blockchain)

The event emits:

- `recipient`: address - Wallet receiving the reward
- `fid`: uint256 - Farcaster ID
- `amount`: uint256 - Reward amount
- `day`: uint256 - Day number
- `castHash`: string - Cast hash
- `caller`: address - Address that called the claim function

## Notes

- All wallet addresses are normalized to lowercase
- BigInt values (amount, day, blockNumber, timestamp) are converted to strings to avoid JSON serialization issues
- The `id` field combines transaction hash and log index to ensure uniqueness even if multiple claims occur in the same transaction
- The endpoint should handle duplicate submissions gracefully (idempotency recommended)
