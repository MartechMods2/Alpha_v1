// Bounded transient state; this never stores durable settings or session keys.
export class BoundedTtlMap extends Map {
  constructor({max = 2000, ttl = 600000, now = Date.now} = {}) {
    super(); this.max = max; this.ttl = ttl; this.now = now; this.expiry = new Map();
  }
  get(key) {
    if ((this.expiry.get(key) || 0) <= this.now()) { this.delete(key); return undefined; }
    return super.get(key);
  }
  has(key) { return this.get(key) !== undefined; }
  set(key,value) {
    this.prune();
    if (super.has(key)) this.delete(key);
    while (this.size >= this.max) this.delete(this.keys().next().value);
    super.set(key,value); this.expiry.set(key,this.now()+this.ttl); return this;
  }
  delete(key) { this.expiry.delete(key); return super.delete(key); }
  clear() { this.expiry.clear(); super.clear(); }
  prune() { const now=this.now(); for(const [key, until] of this.expiry) {if(until > now) break; this.delete(key);} }
}
