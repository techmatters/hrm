import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface CaseAuditAttributes {
  accountSid: string;
  caseId: number;
  newValue: string;
  previousValue: string;
  twilioWorkerId: string;
};

export interface CaseAuditModel extends Model<CaseAuditAttributes>, CaseAuditAttributes {}

export class CaseAudit extends Model<CaseAuditModel, CaseAuditAttributes> { }

export type CaseAuditStatic = typeof Model & {
  new (values?: object, options?: BuildOptions): CaseAuditModel;
};

export function CaseAuditFactory (sequelize: Sequelize): CaseAuditStatic {
  return <CaseAuditStatic>sequelize.define('CaseAudit', {
    accountSid: { type: DataTypes.STRING },
    caseId: { type: DataTypes.NUMBER },
    newValue: { type: DataTypes.STRING },
    previousValue:  { type: DataTypes.STRING },
    twilioWorkerId: { type: DataTypes.STRING }, 
  })
};

// module.exports = (sequelize, DataTypes) => {
//   const CaseAudit = sequelize.define('CaseAudit', {
//     twilioWorkerId: DataTypes.STRING,
//     previousValue: DataTypes.JSONB,
//     newValue: DataTypes.JSONB,
//     /**
//      * In theory, we shouldn't need to explicitly declare 'caseId' here,
//      * since the association CaseAudit.belongsTo(Case) would handle it.
//      * But sequelize was NOT inserting 'caseId' when CREATING a CaseAudit.
//      */
//     caseId: DataTypes.INTEGER,
//     accountSid: DataTypes.STRING,
//   });

//   CaseAudit.associate = models => CaseAudit.belongsTo(models.Case, { foreignKey: 'caseId' });

//   return CaseAudit;
// };
