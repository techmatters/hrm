import { 
  Sequelize,
  Model,
  DataTypes,
 } from 'sequelize';

interface CaseAuditAttributes {
  accountSid: string;
  caseId: number;
  newValue: string;
  previousValue: string;
  twilioWorkerId: string;
};

export interface CaseAuditModel extends Model<CaseAuditAttributes>, CaseAuditAttributes {}

export class CaseAudit extends Model<CaseAuditModel, CaseAuditAttributes> {
  static associate = models => CaseAudit.belongsTo(models.Case, { foreignKey: 'caseId' });
}

export default (sequelize: Sequelize): typeof CaseAudit => {
  CaseAudit.init({
    accountSid: { type: DataTypes.STRING },
    caseId: { type: DataTypes.NUMBER },
    newValue: { type: DataTypes.STRING },
    previousValue:  { type: DataTypes.STRING },
    twilioWorkerId: { type: DataTypes.STRING }, 
  }, 
  {
    tableName  : 'CaseAudit',
    sequelize
  })

  return CaseAudit;

  // const CaseAudit = <CaseAuditStatic>sequelize.define("CaseAudit", {
  //   accountSid: { type: DataTypes.STRING },
  //   caseId: { type: DataTypes.NUMBER },
  //   newValue: { type: DataTypes.STRING },
  //   previousValue:  { type: DataTypes.STRING },
  //   twilioWorkerId: { type: DataTypes.STRING }, 
  // });

  // CaseAudit.associate = models => CaseAudit.belongsTo(models.Case, { foreignKey: 'caseId' });

  // return CaseAudit;
}

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
