using RagMiddleware.Infrastructure.Configuration;
using Microsoft.Extensions.Options;
using RagMiddleware.Application.Abstractions;
using RagMiddleware.Infrastructure.Clients;
using RagMiddleware.Infrastructure.Persistence;
using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Infrastructure.Persistence.Repositories;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "FrontendCors";

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        FrontendCorsPolicy,
        policy =>
        {
            policy
                .WithOrigins(
                    "http://localhost:5173",
                    "http://127.0.0.1:5173"
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    );
});

builder.Services
    .AddOptions<RagApiOptions>()
    .Bind(
        builder.Configuration.GetSection(
            RagApiOptions.SectionName
        )
    )
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services
    .AddOptions<MongoDbOptions>()
    .Bind(
        builder.Configuration.GetSection(
            MongoDbOptions.SectionName
        )
    )
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddSingleton<
    MongoConversationRepository
>();

builder.Services.AddSingleton<
    IConversationRepository
>(
    serviceProvider =>
        serviceProvider.GetRequiredService<
            MongoConversationRepository
        >()
);

builder.Services.AddHostedService<
    MongoDbIndexInitializer
>();

builder.Services.AddHttpClient<IRagApiClient, RagApiClient>(
    (serviceProvider, httpClient) =>
    {
        RagApiOptions options = serviceProvider
            .GetRequiredService<IOptions<RagApiOptions>>()
            .Value;

        httpClient.BaseAddress = new Uri(
            $"{options.BaseUrl.TrimEnd('/')}/"
        );

        httpClient.Timeout = TimeSpan.FromMinutes(5);
    }
);
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(FrontendCorsPolicy);

//app.UseHttpsRedirection();

app.MapControllers();

app.Run();