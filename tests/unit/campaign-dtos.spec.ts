import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCampaignDto } from '../../src/campaigns/interfaces/dtos';

describe('campaign DTO validation', () => {
  it('rejects a DM password shorter than six characters', async () => {
    const dto = plainToInstance(CreateCampaignDto, {
      name: 'Tiny Password Keep',
      dmPassword: '123'
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'dmPassword',
          constraints: expect.objectContaining({
            minLength: 'dmPassword must be longer than or equal to 6 characters'
          })
        })
      ])
    );
  });
});

