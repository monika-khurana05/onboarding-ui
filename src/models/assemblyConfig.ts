export type ConfigStatus = 'Pending' | 'Submitted';

export type CapabilityParam = {
  id: string;
  key: string;
  value: string;
};

export type KafkaPurpose = 'INGRESS' | 'EGRESS' | 'RETRY' | 'REF_DATA' | 'DLQ' | 'OTHER';

export type KafkaBinding = {
  id: string;
  purpose: KafkaPurpose;
  topicName: string;
  clusterAlias: string;
  consumerGroup: string;
  keySchema: string;
  valueSchema: string;
  partitionCount?: number;
  replicationFactor?: number;
  notes?: string;
};

export type PrimaryArtifact = {
  groupId: string;
  artifactId: string;
  version: string;
};

export type AdditionalArtifact = {
  id: string;
  groupId: string;
  artifactId: string;
  version: string;
  notes?: string;
};

export type MongoCollectionPurpose = 'TRANSACTION' | 'MEMBERSHIP' | 'PSP_DATA' | 'DUPCHECK' | 'OTHER';

export type MongoCollectionConfig = {
  id: string;
  name: string;
  purpose: MongoCollectionPurpose;
  retentionDays?: number;
  indexesNotes?: string;
};

export type AssemblyCapabilityConfig = {
  id: string;
  capabilityName: string;
  primaryArtifact: PrimaryArtifact;
  additionalArtifacts: AdditionalArtifact[];
  ownerName: string;
  status: ConfigStatus;
  pipelineKey: string;
  kafkaBindings: KafkaBinding[];
  mongoEnabled: boolean;
  mongoSslEnable: boolean;
  mongoServers: string[];
  mongoDatabase: string;
  mongoUsername: string;
  mongoPasswordRef: string;
  mongoAuthDb: string;
  trustStoreLocation: string;
  trustStoreType: string;
  trustStorePasswordRef: string;
  mongoCollections: MongoCollectionConfig[];
  batchingMongoWriterSize?: number;
  threadCount?: number;
  configFiles: string[];
  configPaths: string[];
  capabilityParams: CapabilityParam[];
  lastUpdated: string;
};
