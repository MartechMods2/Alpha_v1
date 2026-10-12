export const privateChatTarget=jid=>{
  const value=String(jid||'').replace(/:\d+@/,'@');
  if(!/^[-a-zA-Z0-9_.]+@(s\.whatsapp\.net|lid)$/.test(value))throw Error('Private recipient unavailable.');
  return value;
};
export const renderPrivateGuide=(rows,prefix='$')=>[
  `ALPHA COMPLETE COMMAND GUIDE — prefix ${prefix}`,
  `${rows.length} registered command names. Access and availability are shown per command. Group-only operations still require a group.`,
  'Replace <required> values; [optional] values may be omitted. Examples are templates. For multiline inputs, preserve the new lines.',
  ...rows.map(row=>[`${prefix}${row.name} — ${row.description}`,`Access: ${row.access}`,`Availability: ${row.disabled?'globally disabled':'registered; group settings and quotas still apply'}`,`Category: ${row.category}`,'Usage:',...row.syntax,'Examples:',...row.examples,...row.notes].join('\n')),
].join('\n\n');
