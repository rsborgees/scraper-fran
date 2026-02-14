#!/usr/bin/env node
/**
 * Executa o Drive Sync Job manualmente
 * Mesmo comportamento do job agendado das 5h
 */

require('dotenv').config();
const { runDailyDriveSyncJob } = require('./cronScheduler');

runDailyDriveSyncJob()
    .then(() => {
        console.log('\n✅ Drive Sync Job concluído!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Erro:', error.message);
        process.exit(1);
    });
