import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
}

/**
 * Sends email through SMTP when SMTP_HOST is configured. Without it (development and tests)
 * messages are logged and kept in `enviados`, so links can be followed locally.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporte: Transporter | null;
  private readonly remitente: string;
  readonly enviados: Correo[] = [];

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.remitente =
      config.get<string>('SMTP_FROM') ?? 'GUIOS PRO <no-reply@guios.local>';
    this.transporte = host
      ? createTransport({
          host,
          port: Number(config.get<string>('SMTP_PORT') ?? 587),
          auth: config.get<string>('SMTP_USER')
            ? {
                user: config.get<string>('SMTP_USER'),
                pass: config.get<string>('SMTP_PASS'),
              }
            : undefined,
        })
      : null;
  }

  async enviar(correo: Correo): Promise<void> {
    if (!this.transporte) {
      this.enviados.push(correo);
      this.logger.log(
        `Email to ${correo.para}: ${correo.asunto}\n${correo.texto}`,
      );
      return;
    }
    await this.transporte.sendMail({
      from: this.remitente,
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
    });
  }
}
