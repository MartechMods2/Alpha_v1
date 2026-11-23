import { receiptReport } from '../../../utils/messageReceipts.js';
export default () => ({
  cmd: ['readby', 'whoread', 'readreceipts'],
  desc: 'Admin: show recorded delivery/read receipts for a quoted message sent by Alpha’s account',
  usage: 'Reply to Alpha’s message: readby [page]',
  handler: receiptReport,
});
