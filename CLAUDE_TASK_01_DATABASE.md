# TASK 01: Database Setup & Migration

## Objective
Get PostgreSQL running and migrate the Prisma schema. This unblocks everything else.

## Steps

### 1. Check/Install PostgreSQL
```bash
# Check if postgres is running
pg_isready

# If not installed, install via Homebrew
brew install postgresql@15
brew services start postgresql@15

# Or use Supabase/Neon for hosted option
```

### 2. Create Database
```bash
createdb client_commerce_platform
```

### 3. Configure Environment
Create `.env` from `.env.example`:
```env
DATABASE_URL="postgresql://localhost:5432/client_commerce_platform"
ANTHROPIC_API_KEY="sk-ant-..." 
```

### 4. Run Migrations
```bash
cd /Users/capitalpawn/Documents/GitHub/client-commerce-platform
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Verify Schema
```bash
npx prisma studio
```
Open browser and confirm all tables exist:
- User, Shop, Submission, Product, Order
- Collection, Offer, Auction, Bid
- Review, PriceAlert, SavedSearch

### 6. Seed Test Data (Optional)
Create `prisma/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create test shop
  const shop = await prisma.shop.create({
    data: {
      name: 'Test Coin Shop',
      email: 'test@coinshop.com',
      // ... minimal required fields
    }
  });
  console.log('Created shop:', shop.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Run: `npx tsx prisma/seed.ts`

## Success Criteria
- [ ] `pg_isready` returns success
- [ ] `.env` file exists with DATABASE_URL
- [ ] `npx prisma migrate dev` completes without errors
- [ ] `npx prisma studio` opens and shows tables
- [ ] Can create/read a test record

## Files to Check
- `prisma/schema.prisma` - the schema
- `.env.example` - template
- `package.json` - has prisma scripts

## Notes
- If schema has errors, fix them before migrating
- Don't modify schema without understanding the relationships
- The schema is comprehensive - 20+ models
