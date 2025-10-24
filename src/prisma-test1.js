// Prisma 
import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client.ts'

const prisma = new PrismaClient();

const audit = await prisma.audit.findMany()

console.log('audit =', audit)

/*
Output: 

D:\RU\Dupfinder>node src/prisma-test1.js
(node:27084) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
audit = [
  { id: 1, auditKey: 'scanFolder', auditValue: 'D:\\', updateIdent: 0 },
  {
    id: 2,
    auditKey: 'mode',
    auditValue: 'concurrent, 8 workers',
    updateIdent: 0
  },
  {
    id: 3,
    auditKey: 'startTime',
    auditValue: '2025-10-24T07:45:53.869Z',
    updateIdent: 0
  },
  {
    id: 4,
    auditKey: 'endTime',
    auditValue: '2025-10-24T07:53:18.664Z',
    updateIdent: 0
  },
  {
    id: 5,
    auditKey: 'elapsedTime',
    auditValue: '444.80',
    updateIdent: 0
  },
  {
    id: 6,
    auditKey: 'enqueuedTotal',
    auditValue: '64829.0',
    updateIdent: 0
  },
  {
    id: 7,
    auditKey: 'filesProcessed',
    auditValue: '64829.0',
    updateIdent: 0
  },
  { id: 8, auditKey: 'difference', auditValue: '0.0', updateIdent: 0 },
  {
    id: 9,
    auditKey: 'filesSkipped',
    auditValue: '0.0',
    updateIdent: 0
  },
  {
    id: 10,
    auditKey: 'missingFiles',
    auditValue: '0.0',
    updateIdent: 0
  }
]

D:\RU\Dupfinder>
*/