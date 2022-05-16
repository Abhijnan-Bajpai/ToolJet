import { EnvironmentVariableDto } from '@dto/environment-variable.dto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrgEnvironmentVariable } from 'src/entities/org_envirnoment_variable.entity';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { cleanObject } from 'src/helpers/utils.helper';
import { EncryptionService } from './encryption.service';

@Injectable()
export class OrgEnvironmentVariablesService {
  constructor(
    @InjectRepository(OrgEnvironmentVariable)
    private orgEnvironmentVariablesRepository: Repository<OrgEnvironmentVariable>,
    private encryptionService: EncryptionService
  ) {}

  async fetchVariables(currentUser: User): Promise<OrgEnvironmentVariable[]> {
    const variables: OrgEnvironmentVariable[] = await this.orgEnvironmentVariablesRepository.find({
      where: { organizationId: currentUser.organizationId },
    });

    await Promise.all(
      variables.map(async (variable: OrgEnvironmentVariable) => {
        if (variable.encrypted) {
          variable['value'] = await this.decryptSecret(variable.value);
        }
      })
    );

    return variables;
  }

  async create(currentUser: User, environmentVariableDto: EnvironmentVariableDto): Promise<OrgEnvironmentVariable> {
    let value: string;
    if (environmentVariableDto.encrypted && environmentVariableDto.value) {
      value = await this.encryptSecret(environmentVariableDto.value);
    } else {
      value = environmentVariableDto.value;
    }
    return await this.orgEnvironmentVariablesRepository.save(
      this.orgEnvironmentVariablesRepository.create({
        variableName: environmentVariableDto.variable_name,
        value,
        encrypted: environmentVariableDto.encrypted,
        organizationId: currentUser.organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
  }

  async fetch(organizationId: string, variableId: string) {
    return await this.orgEnvironmentVariablesRepository.findOne({
      organizationId: organizationId,
      id: variableId,
    });
  }

  async update(organizationId: string, variableId: string, params: any) {
    const { variable_name } = params;
    let value = params.value;
    const variable = await this.fetch(organizationId, variableId);

    if (variable.encrypted && value) {
      value = await this.encryptSecret(value);
    }

    const updateableParams = {
      variableName: variable_name,
      value,
    };

    // removing keys with undefined values
    cleanObject(updateableParams);

    return await this.orgEnvironmentVariablesRepository.update({ organizationId, id: variableId }, updateableParams);
  }

  async delete(organizationId: string, variableId: string) {
    return await this.orgEnvironmentVariablesRepository.delete({ organizationId, id: variableId });
  }

  private async encryptSecret(value: string) {
    return await this.encryptionService.encryptColumnValue('org_environment_variables', 'value', value);
  }

  private async decryptSecret(value: string) {
    return await this.encryptionService.decryptColumnValue('org_environment_variables', 'value', value);
  }
}
