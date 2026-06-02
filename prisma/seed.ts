import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const creatures = [
  {
    name: 'Ice Wraith',
    preferredEnvironment: 'icy tundra, frozen ruins',
    hitPoints: 45,
    armorClass: 14,
    attackInfo: { primary: 'Frost touch', damage: '2d8 cold' },
    rolls: { perception: 3, stealth: 5 }
  },
  {
    name: 'Goblin Scout',
    preferredEnvironment: 'forest, cave, roadside',
    hitPoints: 7,
    armorClass: 15,
    attackInfo: { primary: 'Shortbow', damage: '1d6 + 2 piercing' },
    rolls: { stealth: 6, initiative: 2 }
  },
  {
    name: 'Bandit Captain',
    preferredEnvironment: 'city, road, coastal camp',
    hitPoints: 65,
    armorClass: 15,
    attackInfo: { primary: 'Multiattack', damage: 'scimitar and dagger' },
    rolls: { deception: 4, athletics: 4 }
  },
  {
    name: 'Ash Drake',
    preferredEnvironment: 'volcanic caves, burned forests',
    hitPoints: 82,
    armorClass: 16,
    attackInfo: { primary: 'Bite', damage: '2d10 + 4 piercing' },
    rolls: { perception: 5, intimidation: 6 }
  }
];

async function main() {
  for (const creature of creatures) {
    await prisma.creature.upsert({
      where: { id: creature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      update: creature,
      create: {
        id: creature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        ...creature
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

