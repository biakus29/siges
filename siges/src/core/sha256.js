/* SHA-256 (implémentation compacte, usage local) — portée telle quelle depuis la version validée */
export function sha256(ascii){
  function rr(v,a){ return (v>>>a)|(v<<(32-a)); }
  var maxWord = Math.pow(2,32), result = '', words = [], asciiBitLength = ascii.length*8;
  var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], primeCounter = k.length;
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate,.5)*maxWord)|0;
      k[primeCounter++] = (Math.pow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii += '\x80';
  while (ascii.length%64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    var j = ascii.charCodeAt(i);
    if (j>>8) return null;
    words[i>>2] |= j << ((3-i)%4)*8;
  }
  words[words.length] = ((asciiBitLength/maxWord)|0);
  words[words.length] = (asciiBitLength);
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16), oldHash = hash;
    hash = hash.slice(0,8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i-15], w2 = w[i-2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7]
        + (rr(e,6) ^ rr(e,11) ^ rr(e,25))
        + ((e&hash[5])^((~e)&hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
            w[i-16]
            + (rr(w15,7) ^ rr(w15,18) ^ (w15>>>3))
            + w[i-7]
            + (rr(w2,17) ^ rr(w2,19) ^ (w2>>>10))
          )|0
        );
      var temp2 = (rr(a,2) ^ rr(a,13) ^ rr(a,22))
        + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash = [(temp1+temp2)|0].concat(hash);
      hash[4] = (hash[4]+temp1)|0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i]+oldHash[i])|0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j+1; j--) {
      var b = (hash[i]>>(j*8))&255;
      result += ((b<16)?0:'') + b.toString(16);
    }
  }
  return result;
}
export function sha256utf8(s){ return sha256(unescape(encodeURIComponent(String(s)))); }
export function makeSalt(){ return Math.random().toString(16).slice(2,10) + Math.random().toString(16).slice(2,6); }
export function hashPwd(salt, pwd){ return sha256utf8(salt + ':' + pwd); }
