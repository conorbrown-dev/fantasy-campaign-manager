const target = process.argv[2];

console.log(`before ${target}`);
require(target);
console.log(`after ${target}`);

