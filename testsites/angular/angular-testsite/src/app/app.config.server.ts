import { Title, Meta } from "@angular/platform-browser";import { mergeApplicationConfig, ApplicationConfig, OnInit } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
  provideServerRendering()]

};

export const config = mergeApplicationConfig(appConfig, serverConfig);